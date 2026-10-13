// app/api/estat/population/route.js
import { NextResponse } from "next/server";
import { requirePopulationSession } from "../../../../lib/server-session";
import { fetchEstat } from "../../../../lib/estat-cache.mjs";
import { isMunicipalityCode, numericStat } from "../../../../lib/estat-model.mjs";

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
    const val = numericStat(v["$"]);

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
  const level = searchParams.get("level") || "pref"; // pref | muni | area | housing | housing-pref
  const prefCode = searchParams.get("prefCode");
  const areaCode = searchParams.get("areaCode");

  try {
    const denied = await requirePopulationSession(req);
    if (denied) return denied;
    if (!API_KEY) return NextResponse.json({ error: "統計サービスが設定されていません" }, { status: 503 });
    if (!['pref', 'muni', 'area', 'housing', 'housing-pref'].includes(level) ||
        (prefCode && !/^(0[1-9]|[1-3][0-9]|4[0-7])$/.test(prefCode)) ||
        (areaCode && !/^[0-9]{5}$/.test(areaCode))) {
      return NextResponse.json({ error: 'Invalid area or level' }, { status: 400 });
    }
    let statsDataId = STATSID_PREF;
    let url = "";

    if (level === "pref") {
      statsDataId = STATSID_PREF;
      url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdTab=00001&cdTime=2023100000&cdCat01=A2301&appId=${API_KEY}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;

    } else if (level === "area") {
      if (areaCode) {
        url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${API_KEY}&lang=J&statsDataId=0000020202&cdCat01=B1102&cdTime=2023100000&cdArea=${encodeURIComponent(areaCode)}&metaGetFlg=N&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=0&replaceSpChars=0`;

      } else {
        url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${API_KEY}&lang=J&statsDataId=0000020202&cdCat01=B1102&cdTime=2023100000&metaGetFlg=N&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=0&replaceSpChars=0`;
      }

    } else if (level === "housing") {
      if (!areaCode) {
        return NextResponse.json({ error: "areaCode is required for housing" }, { status: 400 });
      }
      url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${API_KEY}&lang=J&statsDataId=0004021424&cdTab=01-2023&cdArea=${encodeURIComponent(areaCode)}&metaGetFlg=N&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=0&replaceSpChars=0`;

    } else if (level === "housing-pref") {
      if (!prefCode) {
        return NextResponse.json({ error: "prefCode is required for housing-pref" }, { status: 400 });
      }

      const prefAreaCode = `${prefCode}000`;

      url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?appId=${API_KEY}&lang=J&statsDataId=0004021424&cdTab=01-2023&cdArea=${encodeURIComponent(prefAreaCode)}&metaGetFlg=N&cntGetFlg=N&explanationGetFlg=N&annotationGetFlg=N&sectionHeaderFlg=0&replaceSpChars=0`;

    } else {
      if (!prefCode) {
        return NextResponse.json({ error: "prefCode is required for municipality level" }, { status: 400 });
      }

      statsDataId = STATSID_MUNI;
      url = `https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData?cdTab=00001&cdTime=2023100000&cdCat01=A2301&appId=${API_KEY}&statsDataId=${statsDataId}&metaGetFlg=Y&cntGetFlg=N&explanationGetFlg=Y&annotationGetFlg=Y&sectionHeaderFlg=1&replaceSpChars=0`;
    }
    const json = await fetchEstat(url);
    const value = json.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;

    const values = normalizeValues(value);

    // 市町村过滤逻辑
    let filteredValues = values;

    if (level === "muni" && prefCode) {
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        if (!code.startsWith(prefCode) || !isMunicipalityCode(code)) return false;
        return true;
      });

      console.log(
        `Filtered municipalities for prefCode=${prefCode}: ${filteredValues.length} records (excluded=${values.length - filteredValues.length})`
      );
    }

    if (level === "area" && areaCode) {
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return code === areaCode.trim();
      });
    } else if (level === "area" && prefCode) {
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return code.startsWith(prefCode) && isMunicipalityCode(code);
      });
    } else if (level === "area" && !prefCode) {
      // 全件返す（全国合計面積の計算用）
      filteredValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return isMunicipalityCode(code);
      });
    }

    // --- Housing（住宅統計）特别处理 ---
    if (level === "housing") {
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
        const val = numericStat(v["$"]);
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
        housingStats: {
          totalHousing:
            housingResult.purpose["専用住宅"] +
            housingResult.purpose["店舗その他の併用住宅"],
          apartment: housingResult.building["共同住宅"],
          detached: housingResult.building["一戸建"],
          rowhouseOther: housingResult.building["長屋建・その他"],
          ownerOccupied: housingResult.tenure["持ち家"],
          privateRental: housingResult.tenure["民営借家"],
          publicEtcRental: housingResult.tenure["公営等借家"],
          exclusiveResidence: housingResult.purpose["専用住宅"],
          mixedUseResidence: housingResult.purpose["店舗その他の併用住宅"],
        },
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

    if (level === "housing-pref") {
      const targetPrefAreaCode = `${prefCode?.trim()}000`;

      const prefValues = values.filter(v => {
        const code = (v["@area"] || "").trim();
        return code === targetPrefAreaCode;
      });

      const housingResult = {
        purpose: {
          "専用住宅": 0,
          "店舗その他の併用住宅": 0,
        },
        tenure: {
          "持ち家": 0,
          "民営借家": 0,
          "公営等借家": 0,
        },
        building: {
          "共同住宅": 0,
          "一戸建": 0,
          "長屋建・その他": 0,
        },
      };

      prefValues.forEach((v) => {
        const val = numericStat(v["$"]);
        const c1 = String(v["@cat01"] || "");
        const c2 = String(v["@cat02"] || "");
        const c3 = String(v["@cat03"] || "");

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
        level: "housing-pref",
        prefCode,
        housing: housingResult,
        housingStats: {
          totalHousing:
            housingResult.purpose["専用住宅"] +
            housingResult.purpose["店舗その他の併用住宅"],
          apartment: housingResult.building["共同住宅"],
          detached: housingResult.building["一戸建"],
          rowhouseOther: housingResult.building["長屋建・その他"],
          ownerOccupied: housingResult.tenure["持ち家"],
          privateRental: housingResult.tenure["民営借家"],
          publicEtcRental: housingResult.tenure["公営等借家"],
          exclusiveResidence: housingResult.purpose["専用住宅"],
          mixedUseResidence: housingResult.purpose["店舗その他の併用住宅"],
        },
      });
    }

    const records = pickLatestValues(filteredValues);

    return NextResponse.json({ level, prefCode, records });

  } catch (err) {
    console.error("e-Stat request failed");
    return NextResponse.json({
      error: "統計データを取得できませんでした。再試行してください。",
      records: []
    }, { status: 500 });
  }
}
