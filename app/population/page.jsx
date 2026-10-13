"use client";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { colorPalette, buildPrefStats, collapsePrefecture, sumSelectedPopulation } from "../../lib/population-model.mjs";
import { fetchPopulationJSON, mapWithConcurrency, loadPopulationSnapshot } from "../../lib/population-client.mjs";
import JapanMap from "components/JapanMap";
import PrefectureMap from "components/PrefectureMap";
import ZipcodeTooltip from "components/ZipcodeTooltip";
import AlertModal from "components/alert";
import WarningModal from "components/warning";
import ConfirmModal from "components/confirm";
import LoadingModal from "components/loading";
import { prefectures } from "app/config/config";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import SaveVersionModal from "components/saveVersionModal";
import ShowImportResultModal from "components/showImportResultModal";
import ShowImportModal from "components/showImportModal";
import { TrashSimple, CloudArrowDown, ArrowLeft } from "phosphor-react";
import PrefectureHoverTooltip from "components/Prefecturehovertooltip";
import { geoMercator } from "d3-geo";
import {
  EMU_PER_INCH,
  topoToGeoFeatures,
  getFeatureMeta,
  extractProjectedPolygons,
  buildRegionShapeXml,
  buildLabelShapeXml,
  normalizeHex,
} from "../../utils";

export default function Page() {
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [populationData, setPopulationData] = useState({});
  const [selectedPref, setSelectedPref] = useState(null);
  const [rightPanelPref, setRightPanelPref] = useState(null);
  const [zipcodePanelArea, setZipcodePanelArea] = useState(null);
  const [nationalPopulation, setNationalPopulation] = useState(0);
  const [areaData, setAreaData] = useState({});       // code → ha
  const [nationalArea, setNationalArea] = useState(0); // 全国合計面積
  const [housingCache, setHousingCache] = useState({}); // areaCode → housing data
  const [prefMuniMapping, setPrefMuniMapping] = useState({});
  const exportRef = useRef(null);
  const [mapProjectionConfig, setMapProjectionConfig] = useState(null);
  const alertRef = useRef();
  const warningRef = useRef();
  const [latestDbColorNames, setLatestDbColorNames] = useState({});
  const [importEditableColorNames, setImportEditableColorNames] = useState({});

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
  const loadSequenceRef = useRef(0);
  const navigationSequenceRef = useRef(0);
  const editRevisionRef = useRef(0);
  const versionMutationRef = useRef(false);

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



  const getSelectedPrefName = () => {
    if (!selectedPref) return null;
    const pref = prefectures.find(p => p.code === selectedPref);
    return pref ? pref.name : null;
  };

  const fetchLatestImportColorNames = async () => {
    try {
      const response = await fetch('/api/population/map/color-config/latest');
      const result = await response.json();
      if (!result.success) return {};
      return result.colorNames || {};
    } catch (error) {
      console.warn('最新色名取得失敗:', error);
      return {};
    }
  };

  // ファイルインポート処理
  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isZip7 = (value) => /^\d{7}$/.test(String(value ?? '').trim());

    const isHeaderRow = (cols) =>
      cols.some(v => String(v ?? '').replace(/^\uFEFF/, '').trim().includes('分拣码'));

    const shouldSkipRow = (cols) => {
      const values = cols.map(v => String(v ?? '').trim());
      return isHeaderRow(values);
    };

    const normalizeToFirst3UsefulCols = (cols) => {
      const cleaned = cols
        .map(v => String(v ?? '').replace(/^\uFEFF/, '').trim())
        .filter(v => v !== '');

      // 跳过邮编列（7位数字）
      const withoutZip = cleaned.filter(v => !isZip7(v));

      return {
        col1: withoutZip[0] || '',
        col2: withoutZip[1] || '',
        col3: withoutZip[2] || '',
      };
    };

    const buildAreaCandidates = (areaName) => {
      const raw = String(areaName ?? '').trim();
      if (!raw) return [];

      const candidates = [raw];
      const gunIndex = raw.indexOf('郡');

      // 例：西多摩郡日の出町 -> 日の出町
      if (gunIndex !== -1 && gunIndex < raw.length - 1) {
        const shortened = raw.slice(gunIndex + 1).trim();
        if (shortened && !candidates.includes(shortened)) {
          candidates.push(shortened);
        }
      }

      return candidates;
    };

    try {
      let rows = [];

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());

        rows = lines
          .map(line => {
            const cols = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const ch = line[i];
              const next = line[i + 1];

              if (ch === '"') {
                if (inQuotes && next === '"') {
                  current += '"';
                  i++;
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (ch === ',' && !inQuotes) {
                cols.push(current.trim());
                current = '';
              } else {
                current += ch;
              }
            }

            cols.push(current.trim());
            return cols;
          })
          .filter(cols => Array.isArray(cols) && cols.length >= 3)
          .filter(cols => !shouldSkipRow(cols))
          .map(cols => normalizeToFirst3UsefulCols(cols))
          .filter(r => r.col1 && r.col2 && r.col3);
      } else {
        // XLSX / XLS
        const XLSX = await import('xlsx');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        rows = data
          .filter(r => Array.isArray(r) && r.length >= 3)
          .filter(r => !shouldSkipRow(r))
          .map(r => normalizeToFirst3UsefulCols(r))
          .filter(r => r.col1 && r.col2 && r.col3);
      }

      // Extract last segment after final '-' from col1
      const parsed = rows.map(r => {
        const parts = r.col1.split('-');
        const colorKey = (parts[parts.length - 1] || '').trim();

        return {
          colorKey,
          prefName: r.col2.trim(),
          areaName: r.col3.trim(),
          areaCandidates: buildAreaCandidates(r.col3),
        };
      });

      const keys = [...new Set(parsed.map(r => r.colorKey))].sort();

      const latestNames = await fetchLatestImportColorNames();

      const initialMapping = keys.reduce((acc, key) => {
        if (Object.prototype.hasOwnProperty.call(colorPalette, key)) {
          acc[key] = key;
        }
        return acc;
      }, {});

      setImportRawData(parsed);
      setUniqueColorKeys(keys);
      setLatestDbColorNames(latestNames);
      setImportEditableColorNames(latestNames);
      setImportColorMapping(initialMapping);
      setShowImportModal(true);
    } catch (err) {
      warningRef.current?.open({
        message: 'ファイルの読み込みに失敗しました: ' + err.message
      });
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
      importRawData.forEach(({ colorKey, prefName, areaName, areaCandidates }) => {
        const colorId = importColorMapping[colorKey];
        if (!colorId) return;
        if (!prefGroups[prefName]) prefGroups[prefName] = [];
        prefGroups[prefName].push({
          areaName,
          areaCandidates: areaCandidates || [areaName],
          colorId
        });
      });

      const newSelectedAreas = [...selectedAreas];
      const newAreaColors = { ...areaColors };

      await mapWithConcurrency(Object.entries(prefGroups), 4, async ([prefName, areas]) => {
        const pref = prefectures.find(p => p.name === prefName);
        if (!pref) {
          console.warn('都道府県が見つかりません:', prefName);
          areas.forEach(({ areaName }) => {
            errors.push({ prefName, areaName });
          });
          return;
        }

        let geoData;
        try {
          geoData = await fetchPopulationJSON('/maps/prefecture/' + pref.code + '.json');
        } catch {
          areas.forEach(({ areaName }) => errors.push({ prefName, areaName }));
          return;
        }

        let features = [];
        if (Array.isArray(geoData.features)) {
          // GeoJSON
          features = geoData.features;
        } else if (geoData.objects) {
          const objectKey = Object.keys(geoData.objects)[0];
          features = geoData.objects[objectKey]?.geometries || [];
        } else {
          console.warn("構造不明:", prefName);
          areas.forEach(({ areaName }) => {
            errors.push({ prefName, areaName });
          });
          return;
        }

        // Build name -> code map
        const nameToCode = {};
        features.forEach(feature => {
          const props = feature.properties || {};
          const name = props.N03_004 || props.N03_003 || props.N03_002 || props.N03_001;
          const code = props.N03_007;
          if (name && code && !nameToCode[name]) {
            nameToCode[name] = code;
          }
        });

        areas.forEach(({ areaName, areaCandidates, colorId }) => {
          let code = null;

          for (const candidate of (areaCandidates || [areaName])) {
            if (nameToCode[candidate]) {
              code = nameToCode[candidate];
              break;
            }
          }

          if (!code) {
            errors.push({ prefName, areaName });
            return;
          }

          if (!newSelectedAreas.includes(code)) {
            newSelectedAreas.push(code);
          }
          newAreaColors[code] = colorId;
        });
      });

      const nextColorNames = { ...colorNames };
      const usedColorIds = [...new Set(Object.values(importColorMapping).filter(Boolean))];

      usedColorIds.forEach((colorId) => {
        const editedName = String(importEditableColorNames[colorId] ?? "").trim();
        if (editedName) {
          nextColorNames[colorId] = editedName;
        }
      });

      editRevisionRef.current++;
      setColorNames(nextColorNames);
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
    if (versionMutationRef.current) return;
    // 如果是新版本（currentVersionId === null），弹出输入框
    if (currentVersionId === null) {
      setVersionName(`バージョン${new Date().toLocaleString('ja-JP')}`);
      setShowVersionNameModal(true);
      return;
    }

    versionMutationRef.current = true;
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
      warningRef.current?.open({ message: "保存失敗: " + error.message });
    } finally {
      versionMutationRef.current = false;
      setLoading(false);
    }
  };

  // Load population for every selected prefecture; share cached and in-flight requests.
  const reloadPopulationAfterLoad = useCallback(async (loadedAreas = [], loadedSelectedPref = null) => {
    const snapshot = await loadPopulationSnapshot(loadedAreas, loadedSelectedPref);
    setPopulationData(prev => ({ ...prev, ...snapshot.population }));
    setPrefMuniMapping(prev => ({ ...prev, ...snapshot.mapping }));
    setNationalPopulation(snapshot.national);
    return snapshot.mapping;
  }, []);

  const restoreMapVersion = async (data) => {
    navigationSequenceRef.current++;
    editRevisionRef.current++;
    setSelectedAreas(data.selectedAreas || []);
    setAreaColors(data.areaColors || {});
    setColorNames(prev => ({ ...prev, ...data.colorNames }));
    setSelectedPref(data.selectedPref || null);
    setRightPanelPref(null);
    setZipcodePanelArea(null);
    setPrefMuniMapping(data.prefMuniMapping || {});
    setCurrentVersionId(data.versionId ?? null);
    setCurrentVersionName(data.versionName || '');
    await reloadPopulationAfterLoad(data.selectedAreas || [], data.selectedPref || null);
  };

  // 加载版本列表
  const loadVersions = async () => {
    try {
      const response = await fetch('/api/population/map/versions/list', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "バージョン読み込み失敗");
      setVersions(result.versions);
    } catch (error) {
      warningRef?.current?.open({ message: "バージョン読み込み失敗: " + error.message });
    }
  };

  const handleLoadVersion = async (versionId) => {
    const sequence = ++loadSequenceRef.current;
    setLoadingMessage("Loading...");
    setLoading(true);
    try {
      const response = await fetch('/api/population/map/load?versionId=' + versionId, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || '読み込み失敗');
      if (sequence !== loadSequenceRef.current) return;
      await restoreMapVersion(result.data);
      alertRef.current?.open({ message: "バージョンを読み込みました" });
    } catch (error) {
      warningRef.current?.open({ message: '読み込み失敗: ' + error.message });
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  };

  // 删除版本
  const handleDeleteVersion = async (versionId) => {
    if (versionMutationRef.current) return;
    versionMutationRef.current = true;
    setLoadingMessage('削除中...');
    setLoading(true);
    try {
      const response = await fetch(`/api/population/map/versions/delete?versionId=${versionId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      if (result.success) {
        if (String(versionId) === String(currentVersionId)) {
          setCurrentVersionId(null);
          setCurrentVersionName('');
        }
        await loadVersions();
      } else {
        warningRef?.current?.open({ message: `削除失敗: ${result.error}` });
      }
    } catch (error) {
      warningRef?.current?.open({ message: "削除失敗: " + error.message });
    } finally {
      versionMutationRef.current = false;
      setLoading(false);
    }
  };

  // 新版本开始
  const handleNewVersion = () => {
    setSelectedAreas([]);
    setAreaColors({});
    navigationSequenceRef.current++;
    loadSequenceRef.current++;
    editRevisionRef.current++;
    setSelectedPref(null);
    setPrefMuniMapping({});
    setRightPanelPref(null);
    setZipcodePanelArea(null);
    setMapProjectionConfig(null);
    setCurrentVersionId(null);
    setCurrentVersionName("");
    alertRef.current?.open({ message: "新しいバージョンを開始しました" });
  };

  // 保存新版本
  const handleSaveAsNewVersion = async () => {
    if (!versionName.trim() || versionMutationRef.current) return;
    versionMutationRef.current = true;

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
      warningRef?.current?.open({ message: "保存失敗: " + error.message });
    } finally {
      versionMutationRef.current = false;
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



  const fetchHousingData = async (areaCode) => {
    if (!areaCode || housingCache[areaCode]) return;
    try {
      const data = await fetchPopulationJSON('/api/population/estat?level=housing&areaCode=' + areaCode);
      setHousingCache(prev => ({ ...prev, [areaCode]: { housing: data.housing ?? null, chartData: data.chartData ?? null } }));
    } catch (error) {
      console.warn("住宅データ取得失敗:", error.message);
    }
  };

  const handleAreaDetails = area => {
    if (!area.code || !/^[0-9]{5}$/.test(area.code)) return;
    setZipcodePanelArea(prev => prev?.code === area.code ? prev : area);
    fetchHousingData(area.code);
  };

  const handleSelect = async (code) => {
    if (!code || !/^[0-9]{5}$/.test(code)) return;
    const prefCode = code.slice(0, 2);
    const nationalCode = prefCode + '000';
    const wholePref = selectedAreas.includes(nationalCode);
    const revision = ++editRevisionRef.current;
    try {
      let mapping = prefMuniMapping;
      if (wholePref && !mapping[prefCode]?.length) {
        mapping = await reloadPopulationAfterLoad([], prefCode);
        if (revision !== editRevisionRef.current) return;
      }
      const codes = mapping[prefCode] || [];
      if (wholePref && !codes.length) throw new Error('市区町村データがありません');
      const already = wholePref || selectedAreas.includes(code);
      setSelectedAreas(prev => {
        const base = wholePref ? [...new Set([...prev.filter(c => c !== nationalCode), ...codes])] : prev;
        return already ? base.filter(c => c !== code) : [...base, code];
      });
      setAreaColors(prev => {
        const colors = { ...prev };
        if (wholePref) {
          codes.forEach(c => { colors[c] = prev[nationalCode]; });
          delete colors[nationalCode];
        }
        if (already) delete colors[code];
        else colors[code] = currentColor;
        return colors;
      });
      if (!Object.prototype.hasOwnProperty.call(populationData, code)) {
        await reloadPopulationAfterLoad([], prefCode);
      }
    } catch (error) {
      warningRef.current?.open({ message: '人口データ取得失敗: ' + error.message });
    }
  };

  const handleBackToNational = () => {
    setZipcodePanelArea(null);
    navigationSequenceRef.current++;
    editRevisionRef.current++;
    if (selectedPref) {
      const collapsed = collapsePrefecture(selectedPref, selectedAreas, areaColors, prefMuniMapping[selectedPref] || []);
      setSelectedAreas(collapsed.selectedAreas);
      setAreaColors(collapsed.areaColors);
    }
    setSelectedPref(null);
    setMapProjectionConfig(null);
  };

  const hasPrefPopulation = prefCode => {
    const codes = prefMuniMapping[prefCode] || [];
    return codes.length > 0 && Object.prototype.hasOwnProperty.call(populationData, prefCode + '000') &&
      codes.every(code => Object.prototype.hasOwnProperty.call(populationData, code));
  };

  const handlePrefectureSelect = async (prefCode) => {
    setZipcodePanelArea(null);
    if (selectedPref === prefCode) {
      handleBackToNational();
      return;
    }
    const sequence = ++navigationSequenceRef.current;
    const revision = editRevisionRef.current;
    setMapProjectionConfig(null);
    setSelectedPref(prefCode);
    try {
      const mapping = hasPrefPopulation(prefCode) ? prefMuniMapping : await reloadPopulationAfterLoad([], prefCode);
      if (sequence !== navigationSequenceRef.current || revision !== editRevisionRef.current) return;
      const nationalCode = prefCode + '000';
      if (selectedAreas.includes(nationalCode)) {
        const color = areaColors[nationalCode];
        const codes = mapping[prefCode] || [];
        if (!codes.length) return;
        editRevisionRef.current++;
        setSelectedAreas(prev => [...new Set([...prev.filter(c => c !== nationalCode), ...codes])]);
        setAreaColors(prev => {
          const colors = { ...prev };
          delete colors[nationalCode];
          codes.forEach(code => { colors[code] = color; });
          return colors;
        });
      }
    } catch (error) {
      warningRef.current?.open({ message: '市区町村データ取得失敗: ' + error.message });
    }
  };

  const handlePrefecturePanel = async ({ prefCode, prefName }) => {
    if (rightPanelPref?.prefCode === prefCode) {
      setRightPanelPref(null);
      return;
    }
    setRightPanelPref({ prefCode, prefName });
    if (hasPrefPopulation(prefCode)) return;
    try {
      await reloadPopulationAfterLoad([], prefCode);
    } catch (error) {
      warningRef.current?.open({ message: '統計データ取得失敗: ' + error.message });
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

  const rightPanelStats = useMemo(() => rightPanelPref
    ? buildPrefStats(rightPanelPref.prefCode, selectedAreas, populationData, prefMuniMapping, areaData, nationalPopulation, nationalArea)
    : null, [rightPanelPref, selectedAreas, populationData, prefMuniMapping, areaData, nationalPopulation, nationalArea]);

  const handleMapLoad = useCallback(payload => {
    setMapProjectionConfig(payload?.mapConfig || null);
  }, []);

  const handleCloseRightPanelPref = () => {
    setRightPanelPref(null);
  };

  const getFeatureFillHex = (feature) => {
    const { code } = getFeatureMeta(feature);

    if (!selectedAreas.includes(code)) return "#e7e7e7";

    const colorId = areaColors[code];
    return colorPalette[colorId] || "#e7e7e7";
  };

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

  const { total: totalPopulation, colors: colorStats } = useMemo(
    () => sumSelectedPopulation(selectedAreas, populationData, areaColors),
    [selectedAreas, populationData, areaColors]
  );

  const getRingArea = (ring = []) => {
    if (!Array.isArray(ring) || ring.length < 3) return 0;

    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += x1 * y2 - x2 * y1;
    }
    return Math.abs(sum) / 2;
  };

  const simplifyRingPoints = (ring = [], pointStep = 1) => {
    if (!Array.isArray(ring) || ring.length <= 8 || pointStep <= 1) return ring;

    const isClosed =
      ring.length > 1 &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1];

    const points = isClosed ? ring.slice(0, -1) : [...ring];

    const simplified = points.filter((_, i) => {
      return i === 0 || i === points.length - 1 || i % pointStep === 0;
    });

    if (simplified.length < 3) return ring;

    if (isClosed) simplified.push([...simplified[0]]);
    return simplified.length >= 4 ? simplified : ring;
  };

  const simplifyProjectedPolygons = (
    polygons = [],
    { minPolygonArea = 0, pointStep = 1 } = {}
  ) => {
    return polygons
      .map((polygon) => {
        const simplifiedRings = polygon
          .map((ring) => simplifyRingPoints(ring, pointStep))
          .filter((ring, ringIndex) => {
            const area = getRingArea(ring);
            return ringIndex === 0
              ? area >= minPolygonArea
              : area >= minPolygonArea * 0.5;
          });

        return simplifiedRings;
      })
      .filter((polygon) => polygon.length > 0);
  };

  const getPolygonArea = (polygon = []) => {
    if (!Array.isArray(polygon) || !polygon.length) return 0;
    return getRingArea(polygon[0] || []);
  };

  const handleDownloadPPTX = async () => {
    if (!selectedPref) {
      warningRef.current?.open({ message: "先に都道府県地図を開いてください。" });
      return;
    }

    try {
      setLoadingMessage("PPTX出力中...");
      setLoading(true);

      const topo = await fetchPopulationJSON('/maps/prefecture/' + selectedPref + '.json');
      const geojson = topo.type === 'FeatureCollection' ? topo : topoToGeoFeatures(topo);

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
      pptx.author = "池田 雄太";
      pptx.subject = "Prefecture map";
      pptx.title = `${getSelectedPrefName() || selectedPref} map`;
      pptx.company = "エスポリア配送部";
      pptx.lang = "ja-JP";

      const slide = pptx.addSlide();

      slide.addText(
        `${getSelectedPrefName() || selectedPref}`,
        {
          x: 0.5,
          y: 0.5,
          w: 2.8,
          h: 0.28,
          fontFace: "Noto Sans JP",
          fontSize: 28,
          bold: true,
          color: "333333",
          margin: 0,
        }
      );

      const exVersionName = currentVersionName?.trim() || versionName?.trim() || "";

      console.log("exVersionName:" + exVersionName);

      if (exVersionName) {
        slide.addText(exVersionName, {
          x: 0.5,
          y: 0.9,
          w: 2.8,
          h: 0.22,
          fontFace: "Noto Sans JP",
          fontSize: 14,
          bold: false,
          color: "666666",
          margin: 0,
        });
      }

      const legendItems = getUsedColorLegendItems();

      legendItems.forEach((item, idx) => {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.5,
          y: 1.8 + idx * 0.24,
          w: 0.16,
          h: 0.16,
          line: { color: "FFFFFF", pt: 0.7 },
          fill: { color: normalizeHex(item.hex) },
        });

        slide.addText(item.name, {
          x: 0.8,
          y: 1.8 + idx * 0.24,
          w: 2.3,
          h: 0.2,
          fontFace: "Noto Sans JP",
          fontSize: 12,
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

      const MAX_PPTX_SIZE = 400 * 1024;

      const compressionLevels = [
        { minPolygonArea: 0, pointStep: 1 },
        { minPolygonArea: 8, pointStep: 2 },
        { minPolygonArea: 16, pointStep: 3 },
        { minPolygonArea: 30, pointStep: 4 },
        { minPolygonArea: 60, pointStep: 6 },
        { minPolygonArea: 100, pointStep: 8 },
      ];

      const baseSlideXml = slideXml;
      const spTreeCloseTag = "</p:spTree>";

      let outBlob = null;
      let finalBlobSize = 0;

      for (const level of compressionLevels) {
        const preparedFeatures = geojson.features
          .map((f, idx) => {
            const rawPolygons = extractProjectedPolygons(f, projection);
            if (!rawPolygons.length) return null;

            const simplifiedPolygons = simplifyProjectedPolygons(rawPolygons, level);
            if (!simplifiedPolygons.length) return null;

            const featureArea = simplifiedPolygons.reduce(
              (sum, polygon) => sum + getPolygonArea(polygon),
              0
            );

            return {
              feature: f,
              index: idx,
              polygons: simplifiedPolygons,
              featureArea,
            };
          })
          .filter(Boolean);

        const regionShapesXml = preparedFeatures
          .map(({ feature, index, polygons }) => {
            const shiftedPolygons = polygons.map((polygon) =>
              polygon.map((ring) =>
                ring.map(([x, y]) => [
                  x + mapLeftEmu / slideScaleX,
                  y + mapTopEmu / slideScaleY,
                ])
              )
            );

            return buildRegionShapeXml({
              feature,
              polygons: shiftedPolygons,
              index,
              slideScaleX,
              slideScaleY,
              getFeatureFillHex,
            });
          })
          .join("");

        const shownNames = new Set();

        const labelShapesXml = preparedFeatures
          .map(({ feature, index }) => {
            const meta = getFeatureMeta(feature);
            const name = meta.name;

            if (!name) return "";
            if (shownNames.has(name)) return "";

            shownNames.add(name);

            return buildLabelShapeXml({
              feature,
              projection,
              slideScaleX,
              slideScaleY,
              offsetXPx: mapLeftEmu / slideScaleX,
              offsetYPx: mapTopEmu / slideScaleY,
              index,
            });
          })
          .join("");

        const updatedSlideXml = baseSlideXml.replace(
          spTreeCloseTag,
          `${regionShapesXml}${labelShapesXml}${spTreeCloseTag}`
        );

        zip.file(slidePath, updatedSlideXml);

        const candidateBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });

        outBlob = candidateBlob;
        finalBlobSize = candidateBlob.size;

        if (candidateBlob.size <= MAX_PPTX_SIZE) {
          break;
        }
      }

      if (!outBlob) {
        throw new Error("PPTX生成に失敗しました");
      }

      if (finalBlobSize > MAX_PPTX_SIZE) {
        throw new Error(
          `圧縮後も400KBを超えています: ${Math.ceil(finalBlobSize / 1024)}KB`
        );
      }

      const url = URL.createObjectURL(outBlob);
      const a = document.createElement("a");
      const exportVersionName = currentVersionName?.trim() || versionName?.trim() || getSelectedPrefName() || selectedPref || "map";
      a.href = url;
      a.download = `${getSelectedPrefName()}_${exportVersionName}_${new Date().toISOString().slice(0, 10)}.pptx`;
      a.click();
      URL.revokeObjectURL(url);

      // alertRef.current?.open({ message: "PPTXを出力しました。" });
    } catch (err) {
      warningRef.current?.open({ message: `PPTX出力失敗: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };



  const populationRatio =
    nationalPopulation > 0
      ? ((totalPopulation / nationalPopulation) * 100).toFixed(3)
      : 0;

  const usedColors = new Set(Object.values(areaColors));
  const hasMultipleColors = usedColors.size > 1;

  useEffect(() => {
    let cancelled = false;
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    Promise.allSettled([
      fetch('/api/population/map/load', { cache: 'no-store' }).then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || '読み込み失敗');
        return result.data;
      }),
      fetch('/api/population/map/versions/list', { cache: 'no-store' }).then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'バージョン読み込み失敗');
        return result.versions;
      }),
      fetchPopulationJSON('/api/population/estat?level=area'),
    ]).then(async results => {
      if (cancelled || sequence !== loadSequenceRef.current) return;
      const [mapResult, versionsResult, areaResult] = results;
      if (versionsResult.status === 'fulfilled') setVersions(versionsResult.value);
      if (areaResult.status === 'fulfilled') {
        const records = areaResult.value.records;
        setAreaData(Object.fromEntries(records.map(record => [record.code, record.value])));
        setNationalArea(records.reduce((sum, record) => sum + record.value, 0));
      }
      if (mapResult.status === 'fulfilled') {
        const data = mapResult.value;
        setSelectedAreas(data.selectedAreas || []);
        setAreaColors(data.areaColors || {});
        setColorNames(prev => ({ ...prev, ...data.colorNames }));
        setSelectedPref(data.selectedPref || null);
        setPrefMuniMapping(data.prefMuniMapping || {});
        setCurrentVersionId(data.versionId ?? null);
        setCurrentVersionName(data.versionName || '');
        await reloadPopulationAfterLoad(data.selectedAreas || [], data.selectedPref || null);
      } else {
        await reloadPopulationAfterLoad();
      }
      const errors = results.filter(result => result.status === 'rejected').map(result => result.reason.message);
      if (errors.length) warningRef.current?.open({ message: '読み込み失敗: ' + errors.join('; ') });
    }).catch(error => {
      if (!cancelled) warningRef.current?.open({ message: '読み込み失敗: ' + error.message });
    }).finally(() => {
      if (!cancelled && sequence === loadSequenceRef.current) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [reloadPopulationAfterLoad]);

  return (
    <div ref={exportRef} style={{ containerType: "inline-size", "--population-info-width": "420px" }} className="flex h-screen bg-style overflow-x-auto overflow-y-hidden p-4 md:p-6 gap-4">
      <div className="h-full min-w-[320px] flex-1 table-details border-black">
        <div className="h-full w-full rounded-xl shadow-inner bg-white/30 p-2">
          {!selectedPref ? (
            <JapanMap
              onPrefectureClick={handlePrefecturePanel}
              activePanelPrefCode={rightPanelPref?.prefCode}
              isPrefectureSelected={isPrefectureSelected}
              getPrefectureColor={getPrefectureColor}
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
              onAreaDetails={handleAreaDetails}
              onSelect={handleSelect}
              onBack={handleBackToNational}
              onLoad={handleMapLoad}
            />
          )}
        </div>
      </div>

      <aside
        aria-label="郵便番号詳細"
        aria-hidden={!zipcodePanelArea}
        className="relative h-full shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out motion-reduce:transition-none"
        style={{
          width: zipcodePanelArea ? "min(360px, 85vw)" : "0px",
          marginRight: zipcodePanelArea ? "0px" : "-1rem",
        }}
      >
        <div className="h-full w-[360px] max-w-[85vw] table-div bg-white overflow-hidden">
          {zipcodePanelArea && (
            <ZipcodeTooltip
              key={zipcodePanelArea.code}
              areaName={zipcodePanelArea.name}
              areaCode={zipcodePanelArea.code}
              panelMode={true}
              isVisible={true}
              housingData={housingCache[zipcodePanelArea.code]}
              onClose={() => setZipcodePanelArea(null)}
            />
          )}
        </div>
      </aside>

      <aside aria-label="地図情報" className="relative h-full w-[var(--population-info-width)] max-w-[85vw] shrink-0 table-div bg-white overflow-hidden">
        {rightPanelPref && (
          <button
            onClick={handleCloseRightPanelPref}
            className="absolute text-sm px-1 py-0 left-1 top-6 z-50 w-8 h-8 orther-button"
            title="戻る"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
        )}

        <div className="h-full overflow-y-auto">
          {rightPanelPref ? (
            <div className="pt-0">
              <PrefectureHoverTooltip
                key={rightPanelPref.prefCode}
                prefCode={rightPanelPref.prefCode}
                prefName={rightPanelPref.prefName}
                stats={rightPanelStats}
                isVisible={true}
                panelMode={true}
                onClose={handleCloseRightPanelPref}
              />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-semibold text-gray-800">{selectedAreas.length}</span>個のエリアが色付けされています
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
                    <p className="text-sm">色付きエリアがある都道府県は、色の種類にかかわらず全国地図で赤く表示されます</p>
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
                    インポート
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
                    disabled={!selectedPref || !mapProjectionConfig}
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
            </>
          )}
        </div>
      </aside>
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
        latestDbColorNames={latestDbColorNames}
        importEditableColorNames={importEditableColorNames}
        setImportEditableColorNames={setImportEditableColorNames}
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
