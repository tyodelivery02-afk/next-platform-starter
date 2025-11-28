// app/api/estat/population/route.js
import { NextResponse } from "next/server";

const API_KEY = process.env.ESTAT_API_KEY;
const STATSID_PREF = process.env.ESTAT_STATSID_PREF || "PUT_PREFECTURE_STATS_DATA_ID";
const STATSID_MUNI = process.env.ESTAT_STATSID_MUNI || "PUT_MUNICIPALITY_STATS_DATA_ID";

// VALUE 正规化
function normalizeValues(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// 选最新年度
function pickLatestValues(values) {
  const map = {};

  values.forEach((v) => {
    const areaName = v["@areaName"] || "UNKNOWN";
    const areaCode = v["@area"] || v["@area_code"] || "UNKNOWN";
    const time = v["@time"] ? String(v["@time"]) : null;
    const val = v["$"] != null ? Number(v["$"]) : 0;

    if (!map[areaCode]) {
      map[areaCode] = { name: areaName, time, val };
    } else {
      if (time && map[areaCode].time) {
        if (time > map[areaCode].time) map[areaCode] = { name: areaName, time, val };
      } else {
        map[areaCode] = { name: areaName, time, val };
      }
    }
  });

  return Object.entries(map).map(([code, obj]) => ({
    code,
    name: obj.name,
    value: obj.val,
  }));
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const level = searchParams.get("level") || "pref"; // pref | muni
  const prefCode = searchParams.get("prefCode"); 

  if (!API_KEY) {
    return NextResponse.json({ error: "ESTAT_API_KEY not configured" }, { status: 500 });
  }

  try {
    let statsDataId = STATSID_PREF;
    let url = "";

    if (level === "pref") {
      statsDataId = STATSID_PREF;
      url = `http://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdTab=00001&cdTime=2023100000&cdCat01=A2301&appId=${API_KEY}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;
    } else {
      if (!prefCode) {
        return NextResponse.json({ error: "prefCode is required for municipality level" }, { status: 400 });
      }

      statsDataId = STATSID_MUNI;
      url = `http://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdTab=00001&cdTime=2023100000&cdCat01=A2301&appId=${API_KEY}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;
    }

    console.log("Fetching e-Stat API:", url);

    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      console.error("e-Stat API error:", txt);
      return NextResponse.json({
        error: "e-Stat fetch failed",
        status: res.status,
        body: txt
      }, { status: 502 });
    }

    const json = await res.json();

    console.log("e-Stat response structure:", {
      hasData: !!json.GET_STATS_DATA,
      status: json.GET_STATS_DATA?.RESULT?.STATUS,
      errorMsg: json.GET_STATS_DATA?.RESULT?.ERROR_MSG,
      valueCount: Array.isArray(json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE)
        ? json.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE.length
        : json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE ? 1 : 0
    });

    // API 错误
    if (json.GET_STATS_DATA?.RESULT?.STATUS !== 0) {
      const errorMsg = json.GET_STATS_DATA?.RESULT?.ERROR_MSG || "Unknown error";
      console.error("e-Stat API returned error:", errorMsg);
      return NextResponse.json({
        error: "e-Stat API error",
        message: errorMsg,
        records: []
      }, { status: 200 });
    }

    const value = json.GET_STATS_DATA?.STATISTICAL_DATA?.DATA_INF?.VALUE;
    if (!value) {
      console.warn("No VALUE data in response");
      return NextResponse.json({
        level,
        prefCode,
        records: [],
        warning: "No data available"
      });
    }

    const values = normalizeValues(value);
    console.log("Total values received:", values.length);

    // 市町村过滤逻辑
    let filteredValues = values;

    if (level === "muni" && prefCode) {
      const EXCLUDED_CODES = new Set([
        "01100", "04100", "11100", "12100", "13100", "14100", "14130", "14150",
        "15100", "22100", "22130", "23100", "26100", "27100", "27140",
        "28100", "33100", "34100", "40100", "40130", "43100"
      ]);

      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        if (!code.startsWith(prefCode)) return false;
        if (EXCLUDED_CODES.has(code.slice(0, 5))) return false;
        return true;
      });

      console.log(
        `Filtered municipalities for prefCode=${prefCode}: ${filteredValues.length} records (excluded=${values.length - filteredValues.length})`
      );
    }

    const records = pickLatestValues(filteredValues);

    return NextResponse.json({ level, prefCode, records });

  } catch (err) {
    console.error("API route error:", err);
    return NextResponse.json({
      error: err.message,
      records: []
    }, { status: 500 });
  }
}
