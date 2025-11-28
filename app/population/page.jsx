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
    color3: "イエロー",
    color4: "パープル",
    color5: "ローズピンク",
    color6: "オレンジイエロー",
    color7: "ダークグレー",
    color8: "オレンジ",
    color9: "ダークレッド",
    color10: "ライトグラスグリーン",
  });
  const [colorStats, setColorStats] = useState({});

  // 保存/加载相关状态
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");

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
  };

  // 保存地图
  const handleSaveMap = async () => {
    setLoadingMessage("Executing...");
    setLoading(true);
    try {
      const response = await fetch('/api/map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedAreas,
          areaColors,
          colorNames,
          selectedPref,
          prefMuniMapping
        })
      });

      const result = await response.json();

      if (result.success) {
        alertRef.current?.open({ message: "保存成功！" });
      } else {
        alertRef.current?.open({ message: "保存失敗！" });
        warningRef.current?.open({ message: `保存失敗: ${result.error}` });
      }
    } catch (error) {
      alertRef.current?.open({ message: "保存失敗！" });
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
      // ① もし特定の都道府県画面（市区町村単位）を開いている場合
      if (loadedSelectedPref) {
        const url = `/api/estat/population?level=muni&prefCode=${loadedSelectedPref}`;
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
      const prefRes = await fetch(`/api/estat/population?level=pref`);
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
        const url = `/api/estat/population?level=muni&prefCode=${prefCode}`;
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
      const response = await fetch('/api/map/load');
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
        const url = `/api/estat/population?level=${level}${selectedPref ? "&prefCode=" + selectedPref : ""}`;
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
        const url = `/api/estat/population?level=muni&prefCode=${prefCode}`;
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

  const handleDownloadPNG = () => {
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

    const width = 1600;
    const height = 1200;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + 100;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const projection = geoMercator().fitSize([width, height], mapGeoJSON);
    const pathGenerator = geoPath().projection(projection).context(ctx);

    ctx.save();
    ctx.translate(currentTransform.x * (width / 800), currentTransform.y * (height / 600));
    ctx.scale(currentTransform.k, currentTransform.k);

    const drawnNames = new Set();

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
      let fillColor = selectedPref ? "#93c5fd" : "#60a5fa";

      if (!selectedPref) {
        const prefCode = code.substring(0, 2);
        isSelected = isPrefectureSelected(prefCode);
        if (isSelected) {
          const colorId = getPrefectureColor(prefCode);
          if (colorId && colorId !== "mixed") {
            fillColor = colorPalette[colorId];
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
          }
        }
      }

      ctx.beginPath();
      pathGenerator(feature);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 / currentTransform.k;
      ctx.stroke();

      if (name && !drawnNames.has(name)) {
        drawnNames.add(name);
        const centroid = pathGenerator.centroid(feature);
        if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
          ctx.fillStyle = "#000000";
          ctx.font = `${16 / currentTransform.k}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(name, centroid[0], centroid[1]);
        }
      }
    });

    ctx.restore();

    ctx.fillStyle = "#000000";
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      `総人口: ${totalPopulation.toLocaleString()}人`,
      width / 2,
      height + 35
    );
    ctx.fillText(
      `全国人口の約 ${populationRatio}%`,
      width / 2,
      height + 70
    );

    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const mapType = selectedPref ? `pref_${selectedPref}` : "national";
      link.download = `population_map_${mapType}_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
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
                value={colorNames[currentColor]}
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
              buttonText="保存"
              message="保存しますか"
              buttonColor="save-button"
            />

            {/* PNG 导出 */}
            <button
              className={`orther-button ${mapGeoJSON
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-400 cursor-not-allowed"
                }`}
              onClick={handleDownloadPNG}
              disabled={!mapGeoJSON}
            >
              PNG出力
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
    </div>
  );
}