// app/api/estat/population/route.js
import { NextResponse } from "next/server";

const API_KEY = process.env.ESTAT_API_KEY;
const STATSID_PREF = process.env.ESTAT_STATSID_PREF || "PUT_PREFECTURE_STATS_DATA_ID";
const STATSID_MUNI = process.env.ESTAT_STATSID_MUNI || "PUT_MUNICIPALITY_STATS_DATA_ID";
const CATEGORY_MAP = {
  // cat01: 住宅の用途
  "1": "専用住宅",
  "2": "店舗併用",

  // cat02: 住宅の所有の関係
  "1": "持ち家",
  "2": "民営借家",
  "21": "公営借家",
  "22": "公社借家",
  "23": "UR借家",
  "24": "給与住宅",

  // cat03: 住宅の建て方
  "1": "一戸建",
  "2": "長屋建",
  "3": "共同住宅",
  "4": "その他"
};

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
    } else if (level === "area") {
      url = `http://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdCat01=B1102&cdTime=2023100000&appId=${API_KEY}&lang=J&statsDataId=0000020202&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;
    } else if (level === "housing") {
      const areaCode = searchParams.get("areaCode");
      if (!areaCode) {
        return NextResponse.json({ error: "areaCode is required for housing" }, { status: 400 });
      }
      url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${API_KEY}&lang=J&statsDataId=0004021424&cdTab=01-2023&cdArea=${encodeURIComponent(areaCode)}&metaGetFlg=N&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=0&replaceSpChars=0`;
    } else {
      if (!prefCode) {
        return NextResponse.json({ error: "prefCode is required for municipality level" }, { status: 400 });
      }

      statsDataId = STATSID_MUNI;
      url = `http://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdTab=00001&cdTime=2023100000&cdCat01=A2301&appId=${API_KEY}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;
    }
    console.log("Fetching e-Stat API:", url);

    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });
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

    if (level === "area" && prefCode) {
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return code.startsWith(prefCode) && !code.endsWith("000");
      });
    } else if (level === "area" && !prefCode) {
      // 全件返す（全国合計面積の計算用）
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return !code.endsWith("000");
      });
    }

    // --- Housing（住宅統計）特别处理 ---
    if (level === "housing") {
      const areaCode = searchParams.get("areaCode");
      const targetCode = areaCode?.trim();
      const areaValues = values.filter(v => (v["@area"] || "").trim() === targetCode);

      const housingResult = {
        purpose: {
          "専用住宅": 0,
          "店舗その他の併用住宅": 0,
        },
        tenure: {
          "持ち家": 0,
          "民営借家": 0,
          "公営等借家": 0, // 公営 + UR + 公社 + 給与住宅
        },
        building: {
          "共同住宅": 0,
          "一戸建": 0,
          "長屋建・その他": 0,
        },
      };

      areaValues.forEach((v) => {
        const val = v["$"] != null ? Number(v["$"]) : 0;
        const c1 = String(v["@cat01"] || ""); // 用途
        const c2 = String(v["@cat02"] || ""); // 产权
        const c3 = String(v["@cat03"] || ""); // 建筑形态

        // 只统计“其他两个维度都是总数(0)”的记录，避免交叉表重复累计

        // 1) 最内层：住宅用途
        if (c2 === "0" && c3 === "0") {
          if (c1 === "1") housingResult.purpose["専用住宅"] += val;
          else if (c1 === "2") housingResult.purpose["店舗その他の併用住宅"] += val;
        }

        // 2) 第2层：产权关系
        if (c1 === "0" && c3 === "0") {
          if (c2 === "1") housingResult.tenure["持ち家"] += val;
          else if (c2 === "2") housingResult.tenure["民営借家"] += val;
          else if (["21", "22", "23", "24"].includes(c2)) {
            housingResult.tenure["公営等借家"] += val;
          }
        }

        // 3) 最外层：建筑形态
        if (c1 === "0" && c2 === "0") {
          if (c3 === "3") housingResult.building["共同住宅"] += val;
          else if (c3 === "1") housingResult.building["一戸建"] += val;
          else if (c3 === "2" || c3 === "4") {
            housingResult.building["長屋建・その他"] += val;
          }
        }
      });

      return NextResponse.json({
        level: "housing",
        areaCode,
        housing: housingResult,
        chartData: {
          inner: [
            { name: "専用住宅", value: housingResult.purpose["専用住宅"] },
            { name: "店舗その他の併用住宅", value: housingResult.purpose["店舗その他の併用住宅"] },
          ],
          middle: [
            { name: "持ち家", value: housingResult.tenure["持ち家"] },
            { name: "民営借家", value: housingResult.tenure["民営借家"] },
            { name: "公営等借家", value: housingResult.tenure["公営等借家"] },
          ],
          outer: [
            { name: "共同住宅", value: housingResult.building["共同住宅"] },
            { name: "一戸建", value: housingResult.building["一戸建"] },
            { name: "長屋建・その他", value: housingResult.building["長屋建・その他"] },
          ],
        },
      });
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