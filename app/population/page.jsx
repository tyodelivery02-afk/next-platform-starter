"use client";
import { useRef, useEffect, useState } from "react";
import JapanMap from "components/JapanMap";
import PrefectureMap from "components/PrefectureMap";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import ConfirmModal from "components/confirm";
import LoadingModal from "components/loading";
import { prefectures } from "app/config/config";
import { geoPath, geoMercator } from "d3-geo";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import { feature as topoFeature } from "topojson-client";
import SaveVersionModal from "components/saveVersionModal";
import ShowImportResultModal from "components/showImportResultModal";
import ShowImportModal from "components/showImportModal";
import { TrashSimple, CloudArrowDown } from "phosphor-react";

export default function Page() {
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [populationData, setPopulationData] = useState({});
  const [totalPopulation, setTotalPopulation] = useState(0);
  const [selectedPref, setSelectedPref] = useState(null);
  const [nationalPopulation, setNationalPopulation] = useState(124885175);
  const [areaData, setAreaData] = useState({});       // code → km²
  const [nationalArea, setNationalArea] = useState(0); // 全国合計面積
  const [housingCache, setHousingCache] = useState({}); // areaCode → housing data
  const [prefMuniMapping, setPrefMuniMapping] = useState({});
  const exportRef = useRef(null);
  const [mapGeoJSON, setMapGeoJSON] = useState(null);
  const [mapProjectionConfig, setMapProjectionConfig] = useState(null);
  const currentPrefRef = useRef(null);
  const alertRef = useRef();
  const warningRef = useRef();

  // 颜色相关状态
  const [areaColors, setAreaColors] = useState({});
  const [currentColor, setCurrentColor] = useState("color1");
  const [colorNames, setColorNames] = useState({
    color1: "オレンジレッド",
    color2: "エメラルドグリーン",
    color3: "ゴールドイエロー",
    color4: "パープル",
    color5: "チェリーピンク",
    color6: "オレンジ",
    color7: "ダークブルーグレー",
    color8: "ダークオレンジ",
    color9: "ダークレッド",
    color10: "ライトグリーン",
    color11: "コバルトブルー",
    color12: "スカイブルー",
    color13: "ターコイズブルー",
  });
  const [colorStats, setColorStats] = useState({});

  // インポート関連状態
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRawData, setImportRawData] = useState([]);
  const [uniqueColorKeys, setUniqueColorKeys] = useState([]);
  const [importColorMapping, setImportColorMapping] = useState({});
  const importFileRef = useRef(null);
  const [importErrors, setImportErrors] = useState([]);
  const [showImportResultModal, setShowImportResultModal] = useState(false);

  // 保存/加载相关状态
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  // 版本管理相关状态
  const [versions, setVersions] = useState([]);
  const [showVersionNameModal, setShowVersionNameModal] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [currentVersionId, setCurrentVersionId] = useState(null); // 当前编辑的版本ID
  const [currentVersionName, setCurrentVersionName] = useState(""); // 当前版本名称

  const colorPalette = {
    color1: "#FF5733",
    color2: "#28C76F",
    color3: "#FFCC00",
    color4: "#9B59B6",
    color5: "#E91E63",
    color6: "#F39C12",
    color7: "#34495E",
    color8: "#E67E22",
    color9: "#C0392B",
    color10: "#A3CB38",
    color11: "#0047AB",
    color12: "#2b94eb",
    color13: "#30D5C8",
  };

  const EMU_PER_INCH = 914400;

  const getSelectedPrefName = () => {
    if (!selectedPref) return null;
    const pref = prefectures.find(p => p.code === selectedPref);
    return pref ? pref.name : null;
  };

  // ファイルインポート処理
  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      let rows = [];

      if (file.name.endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        rows = lines.map(line => {
          // Handle quoted CSV fields
          const cols = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') { inQuotes = !inQuotes; }
            else if (line[i] === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
            else { current += line[i]; }
          }
          cols.push(current.trim());
          return { col1: cols[0] || '', col2: cols[1] || '', col3: cols[2] || '' };
        });
      } else {
        // XLSX
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        rows = data.filter(r => r && r.length >= 3).map(r => ({
          col1: String(r[0] ?? ''),
          col2: String(r[1] ?? ''),
          col3: String(r[2] ?? ''),
        }));
      }

      // Extract last segment after final '-' from col1
      const parsed = rows
        .filter(r => r.col1 && r.col2 && r.col3)
        .map(r => {
          const parts = r.col1.split('-');
          const colorKey = parts[parts.length - 1];
          return { colorKey, prefName: r.col2, areaName: r.col3 };
        });

      const keys = [...new Set(parsed.map(r => r.colorKey))].sort();

      setImportRawData(parsed);
      setUniqueColorKeys(keys);
      setImportColorMapping({});
      setShowImportModal(true);
    } catch (err) {
      warningRef.current?.open({ message: 'ファイルの読み込みに失敗しました: ' + err.message });
    }

    e.target.value = '';
  };

  // インポート色の適用
  const handleApplyImport = async () => {
    setShowImportModal(false);
    setLoadingMessage("インポート中...");
    setLoading(true);
    const errors = [];

    try {
      // Group areas by prefecture name
      const prefGroups = {};
      importRawData.forEach(({ colorKey, prefName, areaName }) => {
        const colorId = importColorMapping[colorKey];
        if (!colorId) return;
        if (!prefGroups[prefName]) prefGroups[prefName] = [];
        prefGroups[prefName].push({ areaName, colorId });
      });

      const newSelectedAreas = [...selectedAreas];
      const newAreaColors = { ...areaColors };

      for (const [prefName, areas] of Object.entries(prefGroups)) {
        const pref = prefectures.find(p => p.name === prefName);
        if (!pref) {
          console.warn('都道府県が見つかりません:', prefName);
          continue;
        }

        const res = await fetch(`/maps/prefecture/${pref.code}.json`);
        const geoData = await res.json();

        let features = [];
        if (Array.isArray(geoData.features)) {
          // GeoJSON
          features = geoData.features;
        } else if (geoData.objects) {
          const objectKey = Object.keys(geoData.objects)[0];
          features = geoData.objects[objectKey].geometries || [];
        } else {
          console.warn("構造不明:", prefName);
          continue;
        }

        // Build name → code map (deduplicated by first occurrence)
        const nameToCode = {};
        features.forEach(feature => {
          const props = feature.properties || {};
          const name = props.N03_004 || props.N03_003 || props.N03_002 || props.N03_001;
          const code = props.N03_007;
          if (name && code && !nameToCode[name]) nameToCode[name] = code;
        });

        areas.forEach(({ areaName, colorId }) => {
          const code = nameToCode[areaName];
          if (!code) {
            errors.push({ prefName, areaName });
            return;
          }
          if (!newSelectedAreas.includes(code)) newSelectedAreas.push(code);
          newAreaColors[code] = colorId;
        });
      }

      setSelectedAreas(newSelectedAreas);
      setAreaColors(newAreaColors);
      setImportErrors(errors);
      await reloadPopulationAfterLoad(newSelectedAreas, selectedPref);
      if (errors.length > 0) {
        setShowImportResultModal(true);
      } else {
        alertRef.current?.open({ message: 'インポートが完了しました！' });
      }
    } catch (err) {
      warningRef.current?.open({ message: 'インポート適用に失敗しました: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  // 保存地图
  const handleSaveMap = async () => {
    // 如果是新版本（currentVersionId === null），弹出输入框
    if (currentVersionId === null) {
      setVersionName(`バージョン${new Date().toLocaleString('ja-JP')}`);
      setShowVersionNameModal(true);
      return;
    }

    // 如果是已存在的版本，直接覆盖保存
    setLoadingMessage("保存中...");
    setLoading(true);
    try {
      const response = await fetch('/api/population/map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: currentVersionId,
          versionName: currentVersionName,
          selectedAreas,
          areaColors,
          colorNames,
          selectedPref,
          prefMuniMapping
        })
      });

      const result = await response.json();

      if (result.success) {
        await loadVersions();
        alertRef.current?.open({ message: "保存成功！" });
      } else {
        warningRef.current?.open({ message: `保存失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef.current?.open({ message: '保存失敗:', error });
    } finally {
      setLoading(false);
    }
  };

  // 読み込み後に人口データもまとめて再取得する
  const reloadPopulationAfterLoad = async (loadedAreas, loadedSelectedPref) => {
    if (!loadedAreas || loadedAreas.length === 0) return;

    try {
      if (loadedSelectedPref) {
        const url = `/api/population/estat?level=muni&prefCode=${loadedSelectedPref}`;
        const res = await fetch(url);
        const data = await res.json();

        const newPopData = {};
        data.records.forEach((r) => {
          newPopData[r.code] = r.value;
        });

        setPopulationData((prev) => ({ ...prev, ...newPopData }));
        return;
      }

      const prefRes = await fetch(`/api/population/estat?level=pref`);
      const prefData = await prefRes.json();

      const prefPopData = {};
      prefData.records.forEach((r) => {
        prefPopData[r.code] = r.value;
      });

      const muniPrefSet = new Set();
      loadedAreas.forEach((code) => {
        if (!code.endsWith("000")) {
          muniPrefSet.add(code.substring(0, 2));
        }
      });

      const muniPopData = {};
      for (const prefCode of muniPrefSet) {
        const url = `/api/population/estat?level=muni&prefCode=${prefCode}`;
        const res = await fetch(url);
        const data = await res.json();

        data.records.forEach((r) => {
          muniPopData[r.code] = r.value;
        });
      }

      setPopulationData((prev) => ({
        ...prev,
        ...prefPopData,
        ...muniPopData,
      }));
    } catch (e) {
      warningRef.current?.open({ message: "読み込み後の人口データ再取得に失敗しました:", e });
    }
  };

  // 加载地图
  const handleLoadMap = async () => {
    setLoadingMessage("Loading...");
    setLoading(true);
    try {
      const response = await fetch('/api/population/map/load');
      const result = await response.json();

      if (result.success) {
        const { data } = result;

        setSelectedAreas(data.selectedAreas);
        setAreaColors(data.areaColors);
        setColorNames(data.colorNames);
        setSelectedPref(data.selectedPref);
        setPrefMuniMapping(data.prefMuniMapping);

        await reloadPopulationAfterLoad(data.selectedAreas || [], data.selectedPref || null);
      } else {
        warningRef.current?.open({ message: `読み込み失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef.current?.open({ message: "読み込み失敗:", error });
    } finally {
      setLoading(false);
    }
  };

  // 加载版本列表
  const loadVersions = async () => {
    try {
      const response = await fetch('/api/population/map/versions/list');
      const result = await response.json();
      if (result.success) {
        setVersions(result.versions);
      }
    } catch (error) {
      warningRef?.current?.open({ message: "バージョン読み込み失敗:", error });
    }
  };

  // 加载指定版本
  const handleLoadVersion = async (versionId, versionName) => {
    setLoadingMessage("Loading...");
    setLoading(true);
    try {
      const response = await fetch(`/api/population/map/load?versionId=${versionId}`);
      const result = await response.json();

      if (result.success) {
        const { data } = result;
        setSelectedAreas(data.selectedAreas);
        setAreaColors(data.areaColors);
        setColorNames({
          color1: "オレンジレッド",
          color2: "エメラルドグリーン",
          color3: "イエロー",
          color4: "パープル",
          color5: "ローズピンク",
          color6: "オレンジイエロー",
          color7: "ダークグレー",
          color8: "オレンジ",
          color9: "ダークレッド",
          color10: "ライトグラスグリーン",
          color11: "コバルトブルー",
          color12: "ライトブルー",
          color13: "ターコイズブルー",
          ...data.colorNames
        });
        setSelectedPref(data.selectedPref);
        setPrefMuniMapping(data.prefMuniMapping);
        await reloadPopulationAfterLoad(data.selectedAreas || [], data.selectedPref || null);

        setCurrentVersionId(versionId);
        setCurrentVersionName(versionName);

        alertRef.current?.open({ message: "バージョンを読み込みました" });
      } else {
        warningRef?.current?.open({ message: `読み込み失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef?.current?.open({ message: "読み込み失敗:", error });
    } finally {
      setLoading(false);
    }
  };

  // 删除版本
  const handleDeleteVersion = async (versionId) => {
    try {
      const response = await fetch(`/api/population/map/versions/delete?versionId=${versionId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        await loadVersions();
      } else {
        warningRef?.current?.open({ message: `削除失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef?.current?.open({ message: "削除失敗:", error });
    }
  };

  // 新版本开始
  const handleNewVersion = () => {
    setSelectedAreas([]);
    setAreaColors({});
    setPopulationData({});
    setTotalPopulation(0);
    setSelectedPref(null);
    setPrefMuniMapping({});
    setColorStats({});
    setCurrentVersionId(null);
    setCurrentVersionName("");
    alertRef.current?.open({ message: "新しいバージョンを開始しました" });
  };

  // 保存新版本
  const handleSaveAsNewVersion = async () => {
    if (!versionName.trim()) return;

    setLoadingMessage("保存中...");
    setLoading(true);
    try {
      const response = await fetch('/api/population/map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionName: versionName.trim(),
          selectedAreas,
          areaColors,
          colorNames,
          selectedPref,
          prefMuniMapping
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowVersionNameModal(false);
        setVersionName("");
        setCurrentVersionId(result.versionId);
        setCurrentVersionName(versionName.trim());
        await loadVersions();
        alertRef.current?.open({ message: "保存成功！" });
      } else {
        warningRef?.current?.open({ message: `保存失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef?.current?.open({ message: '保存失敗:', error });
    } finally {
      setLoading(false);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const fetchAreaData = async () => {
    try {
      const res = await fetch(`/api/population/estat?level=area`);
      const data = await res.json();
      const map = {};
      let total = 0;
      data.records.forEach(r => {
        map[r.code] = r.value;
        total += r.value;
      });
      setAreaData(map);
      setNationalArea(total);
    } catch (e) {
      console.warn("面積データ取得失敗:", e);
    }
  };

  const fetchHousingData = async (areaCode) => {
    if (!areaCode || housingCache[areaCode]) return;
    try {
      const res = await fetch(`/api/population/estat?level=housing&areaCode=${areaCode}`);
      const data = await res.json();
      if (data.housing || data.chartData) {
        setHousingCache(prev => ({
          ...prev,
          [areaCode]: {
            housing: data.housing ?? null,
            chartData: data.chartData ?? null,
          }
        }));
      }
    } catch (e) {
      console.warn("住宅データ取得失敗:", e);
    }
  };

  const handleSelect = async (code, name) => {
    const already = selectedAreas.includes(code);

    if (already) {
      setSelectedAreas(prev => prev.filter((c) => c !== code));
      setAreaColors(prev => {
        const newColors = { ...prev };
        delete newColors[code];
        return newColors;
      });
    } else {
      setSelectedAreas(prev => [...prev, code]);
      setAreaColors(prev => ({ ...prev, [code]: currentColor }));
    }

    if (!populationData[code]) {
      try {
        const level = selectedPref ? "muni" : "pref";
        const url = `/api/population/estat?level=${level}${selectedPref ? "&prefCode=" + selectedPref : ""}`;
        const res = await fetch(url);
        const data = await res.json();

        let val = 0;
        const record = data.records.find((r) => r.code === code || r.name === name);
        if (record) val = record.value;

        setPopulationData((prev) => ({ ...prev, [code]: val }));
      } catch (err) {
        warningRef.current?.open({ message: "人口データ取得失敗:", err });
      }
    }
  };

  const handlePrefectureSelect = async (prefCode) => {
    if (selectedPref === prefCode) {
      const nationalPrefCode = prefCode + "000";
      const muniCodes = prefMuniMapping[prefCode] || [];
      const selectedMuniCodes = muniCodes.filter(code => selectedAreas.includes(code));

      if (selectedMuniCodes.length > 0 && selectedMuniCodes.length === muniCodes.length) {
        const mergeColor = areaColors[selectedMuniCodes[0]];

        setSelectedAreas((prev) => {
          const withoutMuni = prev.filter(c => !muniCodes.includes(c));
          return [...withoutMuni, nationalPrefCode];
        });
        setAreaColors(prev => {
          const newColors = { ...prev };
          muniCodes.forEach(code => delete newColors[code]);
          newColors[nationalPrefCode] = mergeColor;
          return newColors;
        });
      }

      setSelectedPref(null);
      setMapGeoJSON(null);
      setMapProjectionConfig(null);
      currentPrefRef.current = null;
      return;
    }

    const nationalPrefCode = prefCode + "000";
    const isPrefSelected = selectedAreas.includes(nationalPrefCode);

    setMapGeoJSON(null);
    setMapProjectionConfig(null);
    setSelectedPref(prefCode);
    currentPrefRef.current = prefCode;

    if (isPrefSelected) {
      const prefOriginalColor = areaColors[nationalPrefCode];

      setSelectedAreas((prev) => prev.filter(c => c !== nationalPrefCode));
      setAreaColors(prev => {
        const newColors = { ...prev };
        delete newColors[nationalPrefCode];
        return newColors;
      });

      try {
        const url = `/api/population/estat?level=muni&prefCode=${prefCode}`;
        const res = await fetch(url);
        const data = await res.json();

        const muniCodes = data.records.map((r) => r.code);

        setPrefMuniMapping((prev) => ({ ...prev, [prefCode]: muniCodes }));

        setSelectedAreas((prev) => {
          const newCodes = muniCodes.filter((code) => !prev.includes(code));
          return [...prev, ...newCodes];
        });

        setAreaColors(prev => {
          const newColors = { ...prev };
          muniCodes.forEach(code => {
            newColors[code] = prefOriginalColor;
          });
          return newColors;
        });

        const newPopData = {};
        data.records.forEach((record) => {
          newPopData[record.code] = record.value;
        });
        setPopulationData((prev) => ({ ...prev, ...newPopData }));
      } catch (err) {
        warningRef.current?.open({ message: "市区町村データ取得失敗:", err });
      }
    }
  };

  const isPrefectureSelected = (prefCode) => {
    const nationalPrefCode = prefCode + "000";

    if (selectedAreas.includes(nationalPrefCode)) return true;

    const hasMuniSelected = selectedAreas.some(code => {
      if (code.endsWith("000")) return false;
      return code.substring(0, 2) === prefCode;
    });

    return hasMuniSelected;
  };

  const getPrefectureColor = (prefCode) => {
    const nationalPrefCode = prefCode + "000";

    if (selectedAreas.includes(nationalPrefCode)) {
      return areaColors[nationalPrefCode];
    }

    const muniColors = selectedAreas
      .filter(code => !code.endsWith("000") && code.substring(0, 2) === prefCode)
      .map(code => areaColors[code]);

    if (muniColors.length > 0 && muniColors.every(c => c === muniColors[0])) {
      return muniColors[0];
    }

    return muniColors.length > 0 ? "mixed" : null;
  };

  const handleMapLoad = (payload) => {
    const geojson = payload?.geoJSON || payload;
    const projectionConfig = payload?.mapConfig || null;

    console.log(
      "地図データ更新:",
      selectedPref || "全国",
      "features:",
      geojson?.features?.length || 0
    );

    setMapGeoJSON(geojson);
    setMapProjectionConfig(projectionConfig);
  };

  // ===== PPTX导出相关（仅县地图） =====
  const topoToGeoFeatures = (topology) => {
    const objectKey = Object.keys(topology.objects || {})[0];
    if (!objectKey) throw new Error("TopoJSON objects が見つかりません");

    const fc = topoFeature(topology, topology.objects[objectKey]);
    if (!fc?.features) throw new Error("FeatureCollection 変換失敗");

    return fc;
  };

  const getFeatureMeta = (feature) => {
    return {
      code: feature.properties?.N03_007 || feature.id,
      name:
        feature.properties?.N03_004 ||
        feature.properties?.N03_003 ||
        feature.properties?.N03_002 ||
        feature.properties?.N03_001 ||
        feature.id,
      labelOffsetX: Number(feature.properties?.label_offset_x || 0),
      labelOffsetY: Number(feature.properties?.label_offset_y || 0),
    };
  };

  const getFeatureFillHex = (feature) => {
    const { code } = getFeatureMeta(feature);

    if (!selectedAreas.includes(code)) return "#e7e7e7";

    const colorId = areaColors[code];
    return colorPalette[colorId] || "#e7e7e7";
  };

  const extractProjectedPolygons = (feature, projection) => {
    const geom = feature.geometry;
    if (!geom) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons
      .map((polygon) =>
        polygon.map((ring) =>
          ring
            .map(([lng, lat]) => projection([lng, lat]))
            .filter(Boolean)
        )
      )
      .filter((polygon) => polygon.length > 0);
  };

  const computePolygonBounds = (polygons) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach(([x, y]) => {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });
      });
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return null;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  };

  const normalizeHex = (hex) => String(hex || "#E7E7E7").replace("#", "").toUpperCase();

  const escapeXml = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const getUsedColorLegendItems = () => {
    if (!selectedPref) return [];

    const used = new Set();

    selectedAreas.forEach((code) => {
      if (String(code).substring(0, 2) !== selectedPref) return;
      const colorId = areaColors[code];
      if (colorId) used.add(colorId);
    });

    return Array.from(used).map((colorId) => ({
      colorId,
      hex: colorPalette[colorId],
      name: colorNames[colorId] || colorId,
    }));
  };

  const buildRegionShapeXml = ({
    feature,
    polygons,
    index,
    slideScaleX,
    slideScaleY,
  }) => {
    const meta = getFeatureMeta(feature);
    const fill = normalizeHex(getFeatureFillHex(feature));
    const line = "FFFFFF";

    const bounds = computePolygonBounds(polygons);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return "";

    const xEmu = Math.round(bounds.minX * slideScaleX);
    const yEmu = Math.round(bounds.minY * slideScaleY);
    const wEmu = Math.max(1, Math.round(bounds.width * slideScaleX));
    const hEmu = Math.max(1, Math.round(bounds.height * slideScaleY));

    const shapeName = `muni-${meta.code}-${meta.name}`;

    const pathsXml = polygons.map((polygon) => {
      return polygon.map((ring) => {
        if (!ring.length) return "";

        const localPoints = ring.map(([x, y]) => ({
          x: Math.round((x - bounds.minX) * slideScaleX),
          y: Math.round((y - bounds.minY) * slideScaleY),
        }));

        if (localPoints.length < 2) return "";

        const first = localPoints[0];
        const rest = localPoints.slice(1);

        return `
        <a:path w="${wEmu}" h="${hEmu}">
          <a:moveTo><a:pt x="${first.x}" y="${first.y}"/></a:moveTo>
          ${rest.map((pt) => `<a:lnTo><a:pt x="${pt.x}" y="${pt.y}"/></a:lnTo>`).join("")}
          <a:close/>
        </a:path>
      `;
      }).join("");
    }).join("");

    return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${2000 + index}" name="${escapeXml(shapeName)}"/>
        <p:cNvSpPr/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${xEmu}" y="${yEmu}"/>
          <a:ext cx="${wEmu}" cy="${hEmu}"/>
        </a:xfrm>
        <a:custGeom>
          <a:avLst/>
          <a:gdLst/>
          <a:ahLst/>
          <a:cxnLst/>
          <a:rect l="0" t="0" r="r" b="b"/>
          <a:pathLst>
            ${pathsXml}
          </a:pathLst>
        </a:custGeom>
        <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
        <a:ln w="9525">
          <a:solidFill><a:srgbClr val="${line}"/></a:solidFill>
        </a:ln>
      </p:spPr>
      <p:style>
        <a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef>
        <a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>
        <a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>
        <a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>
      </p:style>
      <p:txBody>
        <a:bodyPr rtlCol="0" anchor="ctr"/>
        <a:lstStyle/>
        <a:p/>
      </p:txBody>
    </p:sp>
  `;
  };

  const buildLabelShapeXml = ({
    feature,
    projection,
    slideScaleX,
    slideScaleY,
    offsetXPx = 0,
    offsetYPx = 0,
    index,
  }) => {
    const meta = getFeatureMeta(feature);
    const pathGenerator = geoPath().projection(projection);
    const centroid = pathGenerator.centroid(feature);

    if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return "";

    const xPx = centroid[0] + meta.labelOffsetX + offsetXPx;
    const yPx = centroid[1] + meta.labelOffsetY + offsetYPx;

    const xEmu = Math.round(xPx * slideScaleX);
    const yEmu = Math.round(yPx * slideScaleY);

    const wEmu = Math.round(0.75 * EMU_PER_INCH);
    const hEmu = Math.round(0.2 * EMU_PER_INCH);

    const leftEmu = xEmu - Math.round(wEmu / 2);
    const topEmu = yEmu - Math.round(hEmu / 2);

    return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="${5000 + index}" name="${escapeXml(`label-${meta.code}-${meta.name}`)}"/>
        <p:cNvSpPr txBox="1"/>
        <p:nvPr/>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${leftEmu}" y="${topEmu}"/>
          <a:ext cx="${wEmu}" cy="${hEmu}"/>
        </a:xfrm>
        <a:prstGeom prst="rect">
          <a:avLst/>
        </a:prstGeom>
        <a:noFill/>
        <a:ln><a:noFill/></a:ln>
      </p:spPr>
      <p:txBody>
        <a:bodyPr wrap="none" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/>
        <a:lstStyle/>
        <a:p>
          <a:pPr algn="ctr"/>
          <a:r>
            <a:rPr lang="ja-JP" sz="700" b="0">
              <a:solidFill><a:srgbClr val="111111"/></a:solidFill>
              <a:latin typeface="Noto Sans JP"/>
              <a:ea typeface="Noto Sans JP"/>
            </a:rPr>
            <a:t>${escapeXml(meta.name)}</a:t>
          </a:r>
          <a:endParaRPr lang="ja-JP" sz="700"/>
        </a:p>
      </p:txBody>
    </p:sp>
  `;
  };

  useEffect(() => {
    const stats = {};
    Object.keys(colorPalette).forEach(colorId => {
      stats[colorId] = 0;
    });

    selectedAreas.forEach((code) => {
      const colorId = areaColors[code];
      if (!colorId) return;

      if (code.endsWith("000")) {
        const prefCode = code.substring(0, 2);
        const muniCodes = prefMuniMapping[prefCode] || [];
        const hasSelectedMuni = muniCodes.some(c => selectedAreas.includes(c));

        if (!hasSelectedMuni) {
          stats[colorId] = (stats[colorId] || 0) + (populationData[code] || 0);
        }
      } else {
        stats[colorId] = (stats[colorId] || 0) + (populationData[code] || 0);
      }
    });

    setColorStats(stats);
  }, [selectedAreas, populationData, prefMuniMapping, areaColors]);

  const handleDownloadPPTX = async () => {
    if (!selectedPref) {
      warningRef.current?.open({ message: "先に都道府県地図を開いてください。" });
      return;
    }

    try {
      setLoadingMessage("PPTX出力中...");
      setLoading(true);

      const res = await fetch(`/maps/prefecture/${selectedPref}.json`);
      if (!res.ok) {
        throw new Error("県地図ファイルの読み込みに失敗しました");
      }

      const topo = await res.json();
      const geojson = topoToGeoFeatures(topo);

      if (!geojson?.features?.length) {
        throw new Error("地図データが空です");
      }

      const renderWidth = 800;
      const renderHeight = 600;

      const projection = geoMercator()
        .scale(mapProjectionConfig?.scale || 2200)
        .center(mapProjectionConfig?.center || [139.7, 35.7])
        .translate([renderWidth / 2, renderHeight / 2]);

      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "OpenAI";
      pptx.subject = "Prefecture map export";
      pptx.title = `${getSelectedPrefName() || selectedPref} map`;
      pptx.company = "OpenAI";
      pptx.lang = "ja-JP";

      const slide = pptx.addSlide();

      slide.addText(
        `${getSelectedPrefName() || selectedPref}`,
        {
          x: 0.2,
          y: 0.08,
          w: 2.8,
          h: 0.28,
          fontFace: "Noto Sans JP",
          fontSize: 18,
          bold: true,
          color: "333333",
          margin: 0,
        }
      );

      const legendItems = getUsedColorLegendItems();

      legendItems.forEach((item, idx) => {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.22,
          y: 0.42 + idx * 0.24,
          w: 0.16,
          h: 0.16,
          line: { color: "FFFFFF", pt: 0.5 },
          fill: { color: normalizeHex(item.hex) },
        });

        slide.addText(item.name, {
          x: 0.42,
          y: 0.395 + idx * 0.24,
          w: 2.3,
          h: 0.2,
          fontFace: "Noto Sans JP",
          fontSize: 9,
          color: "333333",
          margin: 0,
        });
      });

      const arrayBuffer = await pptx.write({ outputType: "arraybuffer" });
      const zip = await JSZip.loadAsync(arrayBuffer);

      const slidePath = "ppt/slides/slide1.xml";
      const slideXml = await zip.file(slidePath).async("string");

      const mapXIn = 0;
      const mapYIn = 0;
      const mapWIn = 12;
      const mapHIn = mapWIn * 3 / 4;

      const mapLeftEmu = Math.round(mapXIn * EMU_PER_INCH);
      const mapTopEmu = Math.round(mapYIn * EMU_PER_INCH);
      const mapWidthEmu = Math.round(mapWIn * EMU_PER_INCH);
      const mapHeightEmu = Math.round(mapHIn * EMU_PER_INCH);

      const slideScaleX = mapWidthEmu / renderWidth;
      const slideScaleY = mapHeightEmu / renderHeight;

      const regionShapesXml = geojson.features.map((f, idx) => {
        const polygons = extractProjectedPolygons(f, projection);
        if (!polygons.length) return "";

        const shiftedPolygons = polygons.map((polygon) =>
          polygon.map((ring) =>
            ring.map(([x, y]) => [
              x + mapLeftEmu / slideScaleX,
              y + mapTopEmu / slideScaleY,
            ])
          )
        );

        return buildRegionShapeXml({
          feature: f,
          polygons: shiftedPolygons,
          index: idx,
          slideScaleX,
          slideScaleY,
        });
      }).join("");

      const shownNames = new Set();

      const labelShapesXml = geojson.features.map((f, idx) => {
        const meta = getFeatureMeta(f);
        const name = meta.name;

        if (!name) return "";
        if (shownNames.has(name)) return "";
        shownNames.add(name);

        return buildLabelShapeXml({
          feature: f,
          projection,
          slideScaleX,
          slideScaleY,
          offsetXPx: mapLeftEmu / slideScaleX,
          offsetYPx: mapTopEmu / slideScaleY,
          index: idx,
        });
      }).join("");

      const spTreeCloseTag = "</p:spTree>";
      const updatedSlideXml = slideXml.replace(
        spTreeCloseTag,
        `${regionShapesXml}${labelShapesXml}${spTreeCloseTag}`
      );

      zip.file(slidePath, updatedSlideXml);

      const outBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(outBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `population_map_${selectedPref}_${new Date().toISOString().slice(0, 10)}.pptx`;
      a.click();
      URL.revokeObjectURL(url);

      alertRef.current?.open({ message: "PPTXを出力しました。" });
    } catch (err) {
      warningRef.current?.open({ message: `PPTX出力失敗: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let total = 0;

    selectedAreas.forEach((code) => {
      if (code.endsWith("000")) {
        const prefCode = code.substring(0, 2);
        const muniCodes = prefMuniMapping[prefCode] || [];
        const hasSelectedMuni = muniCodes.some(c => selectedAreas.includes(c));

        if (!hasSelectedMuni) {
          total += populationData[code] || 0;
        }
      } else {
        total += populationData[code] || 0;
      }
    });

    setTotalPopulation(total);
  }, [selectedAreas, populationData, prefMuniMapping]);

  const populationRatio =
    nationalPopulation > 0
      ? ((totalPopulation / nationalPopulation) * 100).toFixed(3)
      : 0;

  const usedColors = new Set(Object.values(areaColors));
  const hasMultipleColors = usedColors.size > 1;

  useEffect(() => {
    handleLoadMap();
  }, []);

  useEffect(() => { fetchAreaData(); }, []);

  useEffect(() => {
    loadVersions();
  }, []);

  return (
    <div ref={exportRef} className="flex md:flex-row h-screen bg-style overflow-hidden p-4 md:p-6 gap-4">
      <div className="h-full flex-1 table-details border-black">
        <div className="h-full w-full rounded-xl shadow-inner bg-white/30 p-2">
          {!selectedPref ? (
            <JapanMap
              selectedAreas={selectedAreas}
              onSelect={handleSelect}
              isPrefectureSelected={isPrefectureSelected}
              getPrefectureColor={getPrefectureColor}
              areaColors={areaColors}
              colorPalette={colorPalette}
              populationData={populationData}
              prefMuniMapping={prefMuniMapping}
              nationalPopulation={nationalPopulation}
              areaData={areaData}
              nationalArea={nationalArea}
              onLoad={handleMapLoad}
            />
          ) : (
            <PrefectureMap
              key={selectedPref}
              prefCode={selectedPref}
              prefName={getSelectedPrefName()}
              selectedAreas={selectedAreas}
              areaColors={areaColors}
              colorPalette={colorPalette}
              housingCache={housingCache}
              onFetchHousing={fetchHousingData}
              onSelect={handleSelect}
              onBack={() => setSelectedPref(null)}
              onLoad={handleMapLoad}
            />
          )}
        </div>
      </div>

      <div className="w-full md:w-[420px] table-div bg-white overflow-y-auto">
        <p className="text-sm text-gray-600 mb-2">
          <span className="font-semibold text-gray-800">{selectedAreas.length}</span>個地域選択した
        </p>

        <div className="bg-yellow-100 p-4 mb-5 table-details">
          <p className="text-3xl font-extrabold text-yellow-600">
            約{" "}
            <span className="font-semibold text-sky-600">
              {totalPopulation.toLocaleString()}
            </span>
            人
          </p>
          <p className="text-3xl font-extrabold text-yellow-600">
            全国人口の約{" "}
            <span className="font-semibold text-sky-600">{populationRatio}%</span>
          </p>
        </div>

        <details className="table-details mb-2">
          <summary className="table-details-content">統計情報源</summary>
          <div className="p-3 text-sm text-gray-700">
            ・e-Stat 人口データ<br />
            ・総務省統計局<br />
            ・社会・人口統計体系<br />
            ・A2301_住民基本台帳人口(総数)2023年度<br />
            ・B1102_総面積（北方地域及び竹島を含む）【ｈａ】2023年度<br />
          </div>
        </details>

        <details className="table-details">
          <summary className="table-details-content">
            保存したバージョン ({versions.length}/50)
          </summary>

          <ul className="mr-2 ml-1 mt-2 mb-2 space-y-2 max-h-[56vh] overflow-y-auto">
            {versions.length === 0 && (
              <li className="w-full text-center py-4 text-gray-500">
                保存されたバージョンはありません
              </li>
            )}

            {versions.map((version) => (
              <li key={version.id}>
                <div
                  className="w-full px-3 py-2 rounded-lg border border-sky-100 bg-yellow-100 
                     transition-all duration-300 hover:bg-yellow-200 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-800 truncate">
                      {version.name}
                    </span>

                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() =>
                          handleLoadVersion(version.id, version.name)
                        }
                        className="floppyDisk-button"
                      >
                        <CloudArrowDown size={20} weight="bold" />
                      </button>

                      <ConfirmModal
                        onConfirm={() =>
                          handleDeleteVersion(version.id)
                        }
                        buttonText={<TrashSimple size={20} />}
                        message={`「${version.name}」を削除しますか？`}
                        buttonColor="minus-button"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-1">
                    {formatDate(version.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </details>

        <details className="table-details mb-2">
          <summary className="table-details-content">塗りつぶし</summary>
          <div className="mb-4 p-3">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(colorPalette).map(([colorId, hex]) => (
                <button
                  key={colorId}
                  onClick={() => setCurrentColor(colorId)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${currentColor === colorId ? "border-gray-800 scale-110" : "border-gray-300"
                    }`}
                  style={{ backgroundColor: hex }}
                  title={colorNames[colorId]}
                />
              ))}
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-600">名前をカスタマイズ：</label>
              <input
                type="text"
                value={colorNames[currentColor] || ""}
                onChange={(e) => setColorNames(prev => ({ ...prev, [currentColor]: e.target.value }))}
                className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
              />
            </div>
          </div>
        </details>

        {hasMultipleColors && (
          <details className="table-details mb-2">
            <summary className="table-details-content">色別統計</summary>
            <div className="p-2 mb-2 flex flex-wrap gap-2">
              <p className="text-sm">都道府県が複数色の場合、全国地図はグレー表示</p>
              {Object.entries(colorPalette).map(([colorId, hex]) => {
                const pop = colorStats[colorId] || 0;
                if (pop === 0) return null;

                const ratio = nationalPopulation > 0
                  ? ((pop / nationalPopulation) * 100).toFixed(3)
                  : 0;

                return (
                  <div key={colorId} className="p-2 rounded-lg border-2 max-w-50 transition-all duration-300 hover:scale-104"
                    style={{ borderColor: hex, backgroundColor: hex + "20" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: hex }} />
                      <span className="font-semibold text-sm">{colorNames[colorId]}</span>
                    </div>
                    <p className="text-lg font-bold">
                      約 {pop.toLocaleString()}人
                    </p>
                    <p className="text-sm black">
                      全国人口の約 {ratio}%
                    </p>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        <details className="table-details mb-4">
          <summary className="table-details-content">操作</summary>
          <div className="p-3 flex flex-wrap gap-2">
            <ConfirmModal
              onConfirm={handleSaveMap}
              buttonText={currentVersionId === null ? "保存" : `保存 (${currentVersionName})`}
              message={currentVersionId === null ? "新しいバージョンとして保存しますか" : `「${currentVersionName}」を上書き保存しますか？`}
              buttonColor="save-button"
            />

            <ConfirmModal
              onConfirm={handleNewVersion}
              buttonText="新規バージョン"
              message="現在の塗りつぶし情報をクリアして新しいバージョンを開始しますか？"
              buttonColor="orther-button"
            />

            <button className="orther-button" onClick={() => importFileRef.current?.click()}>
              導入
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImportFileChange}
            />

            <button
              className={`orther-button ${selectedPref
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-400 cursor-not-allowed"
                }`}
              onClick={handleDownloadPPTX}
              disabled={!selectedPref}
            >
              PPTX出力
            </button>
          </div>
        </details>

        <details open className="table-details">
          <summary className="table-details-content">都道府県</summary>
          <ul className="mt-2 space-y-1 max-h-[56vh] overflow-y-auto">
            {prefectures.map((p) => (
              <li key={p.code}>
                <button
                  onClick={() => handlePrefectureSelect(p.code)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-200
                    ${selectedPref === p.code
                      ? "bg-yellow-300 text-black shadow-md"
                      : "hover:bg-yellow-200 hover:shadow-sm"
                    }`}
                >
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
      <AlertModal ref={alertRef} />
      <WarningModal ref={warningRef} />
      <LoadingModal show={loading} message={loadingMessage} />
      <SaveVersionModal
        show={showVersionNameModal}
        value={versionName}
        onChange={(e) => setVersionName(e.target.value)}
        onClose={() => setShowVersionNameModal(false)}
        onSave={handleSaveAsNewVersion}
      />
      <ShowImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        uniqueColorKeys={uniqueColorKeys}
        importColorMapping={importColorMapping}
        setImportColorMapping={setImportColorMapping}
        colorPalette={colorPalette}
        colorNames={colorNames}
        onApply={handleApplyImport}
      />
      <ShowImportResultModal
        show={showImportResultModal}
        onClose={() => setShowImportResultModal(false)}
        importErrors={importErrors}
      />
    </div>
  );
}