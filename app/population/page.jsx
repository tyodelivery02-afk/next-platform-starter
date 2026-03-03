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
  const [prefMuniMapping, setPrefMuniMapping] = useState({});
  const exportRef = useRef(null);
  const [mapGeoJSON, setMapGeoJSON] = useState(null);
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
          versionId: currentVersionId,  // 传入版本ID
          versionName: currentVersionName, // 保持原名称
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
    // 选中的区域为空就不用算了
    if (!loadedAreas || loadedAreas.length === 0) return;

    try {
      // もし特定の都道府県画面（市区町村単位）を開いている場合
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

      // ② 全国画面（都道府県＋一部市区町村）の場合

      // 2-1. 都道府県レベル人口（1回だけ）
      const prefRes = await fetch(`/api/population/estat?level=pref`);
      const prefData = await prefRes.json();

      const prefPopData = {};
      prefData.records.forEach((r) => {
        // r.code は "13000" のようなコードを想定
        prefPopData[r.code] = r.value;
      });

      // 2-2. 市区町村レベル人口（必要な都道府県だけ）
      const muniPrefSet = new Set();
      loadedAreas.forEach((code) => {
        if (!code.endsWith("000")) {
          // 先頭2桁 = 都道府県コード
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

      // 2-3. まとめて state へ反映
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

        // 地図の塗り状態を復元したあと、人口データもまとめて再取得
        await reloadPopulationAfterLoad(data.selectedAreas || [], data.selectedPref || null);

        // alert("読み込みました");
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

        // 设置当前版本信息
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
    setCurrentVersionId(null); // 清空当前版本ID
    setCurrentVersionName(""); // 清空当前版本名称
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
        setCurrentVersionId(result.versionId); // 设置当前版本ID
        setCurrentVersionName(versionName.trim()); // 设置当前版本名称
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
      currentPrefRef.current = null;
      return;
    }

    const nationalPrefCode = prefCode + "000";
    const isPrefSelected = selectedAreas.includes(nationalPrefCode);

    setMapGeoJSON(null);
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

  const handleMapLoad = (geojson) => {
    console.log("地図データ更新:", selectedPref || "全国", "features:", geojson.features.length);
    setMapGeoJSON(geojson);
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

  const handleDownloadSVG = () => {
    if (!mapGeoJSON || !mapGeoJSON.features || mapGeoJSON.features.length === 0) {
      warningRef.current?.open({ message: "地図データが読み込まれていません。少々お待ちください。" });
      return;
    }

    const mapSvg = document.querySelector('svg');
    const gElement = mapSvg?.querySelector('g[transform]');
    let currentTransform = { k: 1, x: 0, y: 0 };

    if (gElement) {
      const transformAttr = gElement.getAttribute('transform');
      const translateMatch = transformAttr?.match(/translate\(([^,]+),([^)]+)\)/);
      const scaleMatch = transformAttr?.match(/scale\(([^)]+)\)/);

      if (translateMatch) {
        currentTransform.x = parseFloat(translateMatch[1]);
        currentTransform.y = parseFloat(translateMatch[2]);
      }
      if (scaleMatch) {
        currentTransform.k = parseFloat(scaleMatch[1]);
      }
    }

    // 从GeoJSON中获取map_scale
    const firstFeature = mapGeoJSON.features[0];
    const mapScale = firstFeature?.properties?.map_scale || 2200;
    const width = 1920;
    const height = 1080;
    const padding = 10;
    const svgWidth = width + padding * 2;
    const activeColorCount = Object.values(colorPalette).filter((_, i) => {
      const colorId = Object.keys(colorPalette)[i];
      return (colorStats[colorId] || 0) > 0;
    }).length;
    const statsAreaHeight = Math.max(100, activeColorCount * 60 + 20);
    const svgHeight = height + padding * 2 + statsAreaHeight;

    const projection = geoMercator().fitSize([width, height], mapGeoJSON);
    const pathGenerator = geoPath().projection(projection);

    // 计算SVG与显示的缩放比例差异
    const svgScale = mapScale;
    const pngScale = projection.scale();
    const scaleRatio = pngScale / svgScale;

    const drawnNames = new Set();
    let svgContent = '';
    const colorsOnMap = new Set();

    // 绘制所有区域
    mapGeoJSON.features.forEach((feature) => {
      let code, name;

      if (!selectedPref) {
        code = feature.properties.id;
        name = feature.properties.nam_ja;
      } else {
        code = feature.properties.N03_007;
        name = feature.properties.N03_004 ||
          feature.properties.N03_003 ||
          feature.properties.N03_002 ||
          feature.properties.N03_001;
      }

      let isSelected = false;
      let fillColor = selectedPref ? "#e7e7e7" : "#e7e7e7";

      if (!selectedPref) {
        const prefCode = code.substring(0, 2);
        isSelected = isPrefectureSelected(prefCode);
        if (isSelected) {
          const colorId = getPrefectureColor(prefCode);
          if (colorId && colorId !== "mixed") {
            fillColor = colorPalette[colorId];
            colorsOnMap.add(colorId);
          } else if (colorId === "mixed") {
            fillColor = "#d1d5db";
          }
        }
      } else {
        isSelected = selectedAreas.includes(code);
        if (isSelected) {
          const colorId = areaColors[code];
          if (colorId) {
            fillColor = colorPalette[colorId];
            colorsOnMap.add(colorId);
          }
        }
      }

      const pathData = pathGenerator(feature);
      if (pathData) {
        svgContent += `<path d="${pathData}" fill="${fillColor}" stroke="#ffffff" stroke-width="${1.5 / currentTransform.k}" />`;
      }
    });

    // 绘制所有文字
    let textContent = '';
    mapGeoJSON.features.forEach((feature) => {
      let code, name;

      if (!selectedPref) {
        code = feature.properties.id;
        name = feature.properties.nam_ja;
      } else {
        code = feature.properties.N03_007;
        name = feature.properties.N03_004 ||
          feature.properties.N03_003 ||
          feature.properties.N03_002 ||
          feature.properties.N03_001;
      }

      if (name && !drawnNames.has(name)) {
        drawnNames.add(name);
        const centroid = pathGenerator.centroid(feature);

        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          const offsetX = feature.properties.label_offset_x || 0;
          const offsetY = feature.properties.label_offset_y || 0;

          const textX = centroid[0] + (offsetX * scaleRatio);
          const textY = centroid[1] + (offsetY * scaleRatio);

          textContent += `<text x="${textX}" y="${textY}" 
          font-size="${20 / currentTransform.k}" 
          font-family="sans-serif" 
          text-anchor="middle" 
          dominant-baseline="middle" 
          fill="#000000">${name}</text>`;
        }
      }
    });

    // 统计信息
    const statsFeature = mapGeoJSON.features.find(
      f => f.properties?.stats_x != null || f.properties?.stats_y != null
    );
    const statsStartX = statsFeature?.properties?.stats_x ?? padding;
    const statsStartY = statsFeature?.properties?.stats_y ?? (height + padding * 2 + 35);

    const activeColors = Object.entries(colorPalette).filter(([colorId]) => {
      return colorsOnMap.has(colorId);
    });

    const statsContent = activeColors.map(([colorId, hex], index) => {
      const pop = colorStats[colorId] || 0;
      const ratio = nationalPopulation > 0
        ? ((pop / nationalPopulation) * 100).toFixed(3)
        : 0;
      const name = colorNames[colorId] || colorId;
      const y = statsStartY + index * 60;

      return `
    <rect x="${statsStartX}" y="${y - 22}" width="28" height="28" rx="4" fill="${hex}" />
    <text x="${statsStartX + 38}" y="${y}"  
      font-size="28" font-weight="bold" font-family="sans-serif" 
      text-anchor="start" fill="${hex}">
      ${name}
    </text>
  `;
    }).join('');

    // 组合完整的SVG
    const fullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <g transform="translate(${padding + currentTransform.x * (width / 800)}, ${padding + currentTransform.y * (height / 600)}) scale(${currentTransform.k})">
    ${svgContent}
    ${textContent}
  </g>
  ${statsContent}
</svg>`;

    // 下载SVG文件
    const blob = new Blob([fullSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const mapType = selectedPref ? `pref_${selectedPref}` : "national";
    link.download = `population_map_${mapType}_${new Date().toISOString().slice(0, 10)}.svg`;
    link.click();
    URL.revokeObjectURL(url);
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
            ・A2301_住民基本台帳人口(総数)2023年度
          </div>
        </details>

        {/* 版本管理 */}
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
                  {/* 第一行：名称 + 图标横向排列 */}
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

                  {/* 第二行：日期 */}
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
              className={`orther-button ${mapGeoJSON
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-400 cursor-not-allowed"
                }`}
              onClick={handleDownloadSVG}
              disabled={!mapGeoJSON}
            >
              SVG出力
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
      {/* 版本名称输入模态框 */}
      <SaveVersionModal
        show={showVersionNameModal}
        value={versionName}
        onChange={(e) => setVersionName(e.target.value)}
        onClose={() => setShowVersionNameModal(false)}
        onSave={handleSaveAsNewVersion}
      />
      {/* 导入设定模态框 */}
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
      {/* 导入失败显示模态框 */}
      <ShowImportResultModal
        show={showImportResultModal}
        onClose={() => setShowImportResultModal(false)}
        importErrors={importErrors}
      />
    </div>
  );
}