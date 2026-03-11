"use client";

import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { geoCentroid } from "d3-geo";
import PrefectureHoverTooltip from "components/Prefecturehovertooltip";

export default function JapanMap({
  onSelect,
  isPrefectureSelected,
  getPrefectureColor,
  onLoad,
  selectedAreas = [],
  populationData = {},
  prefMuniMapping = {},
  nationalPopulation = 0,
  areaData = {},
  nationalArea = 0,
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [hoveredPref, setHoveredPref] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverOpenTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const unmountTimerRef = useRef(null);

  // 初始化缩放拖拽
  useEffect(() => {
    const svg = select(svgRef.current);
    const zoomBehavior = zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoomBehavior);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, []);

  const handleMouseEnter = (event, prefCode, prefName) => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    hoverOpenTimerRef.current = setTimeout(() => {
      setHoveredPref({ prefCode, prefName });
      setTooltipPosition({ x: event.clientX, y: event.clientY });
      setTooltipVisible(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setTooltipVisible(true)));
    }, 250);
  };

  const handleMouseLeave = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setTooltipVisible(false);
      unmountTimerRef.current = setTimeout(() => {
        setHoveredPref(null);
        setTooltipPosition(null);
      }, 220);
    }, 150);
  };

  const handleCloseTooltip = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    setTooltipVisible(false);
    unmountTimerRef.current = setTimeout(() => {
      setHoveredPref(null);
      setTooltipPosition(null);
    }, 220);
  };

  const handleTooltipMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
  };

  const handleTooltipMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setTooltipVisible(false);
      unmountTimerRef.current = setTimeout(() => {
        setHoveredPref(null);
        setTooltipPosition(null);
      }, 220);
    }, 150);
  };

  const buildPrefStats = (prefCode) => {
    const nationalCode = prefCode + "000";
    const prefSelectedCodes = selectedAreas.filter(code => code.substring(0, 2) === prefCode);
    const isPrefLevel = prefSelectedCodes.includes(nationalCode);
    let selectedPop = 0;
    if (isPrefLevel) {
      selectedPop = populationData[nationalCode] || 0;
    } else {
      prefSelectedCodes.forEach(code => { selectedPop += populationData[code] || 0; });
    }
    const totalPrefPop = populationData[nationalCode] || 0;
    const muniCodes = prefMuniMapping[prefCode] || [];
    const selectedAreaCount = isPrefLevel ? muniCodes.length || 1 : prefSelectedCodes.filter(c => !c.endsWith("000")).length;
    // 面積計算
    const allPrefAreaCodes = Object.keys(areaData).filter(c => c.startsWith(prefCode));
    const totalPrefArea = allPrefAreaCodes.reduce((sum, c) => sum + (areaData[c] || 0), 0);
    const selectedMuniCodes = prefSelectedCodes.filter(c => !c.endsWith("000"));
    const selectedArea = selectedMuniCodes.reduce((sum, c) => sum + (areaData[c] || 0), 0);
    return {
      selectedPop,
      totalPrefPop,
      nationalPop: nationalPopulation,
      selectedAreaCount,
      totalAreaCount: muniCodes.length,
      prefSelectedCodes: prefSelectedCodes.filter(c => !c.endsWith("000")),
      selectedArea,
      totalPrefArea,
      nationalArea,
    };
  };

  const handleZoomIn = () =>
    setTransform((t) => ({ ...t, k: Math.min(t.k + 0.2, 10) }));
  const handleZoomOut = () =>
    setTransform((t) => ({ ...t, k: Math.max(t.k - 0.2, 1) }));

  return (
    <div className="relative border-2 border-gray-400 rounded-lg p-2 w-full h-full">
      {/* 缩放按钮 */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button onClick={handleZoomIn} className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100">+</button>
        <button onClick={handleZoomOut} className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100">-</button>
      </div>

      {/* 地图 */}
      <ComposableMap
        ref={svgRef}
        projection="geoMercator"
        projectionConfig={{ scale: 1200, center: [137, 37] }}
        width={800}
        height={600}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <Geographies geography="/maps/japan-prefectures.geojson">
            {({ geographies, projection }) => {
              if (geographies && geographies.length > 0 && !isDataLoaded) {
                const geoJSON = {
                  type: "FeatureCollection",
                  features: geographies
                };

                setTimeout(() => {
                  setIsDataLoaded(true);
                  if (onLoad) {
                    onLoad(geoJSON);
                  }
                }, 0);
              }

              return (
                <>
                  {geographies.map((geo) => {
                    const code = geo.properties.id;
                    const name = geo.properties.nam_ja;
                    const prefCode = code.substring(0, 2);
                    const isSelected = isPrefectureSelected(prefCode);

                    // 获取该都道府県的颜色
                    const colorId = getPrefectureColor(prefCode);
                    let fillColor = "#e7e7e7";

                    if (isSelected) {
                      if (colorId && colorId !== "mixed") {
                        fillColor = "#ec2424"; // 全国地图始终显示红色
                      } else if (colorId === "mixed") {
                        fillColor = "#ec2424"; // 混合颜色显示红色
                      }
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onMouseEnter={(event) => handleMouseEnter(event, prefCode, name)}  // ← 追加
                        onMouseLeave={handleMouseLeave}                                     // ← 追加
                        // onClick={() => onSelect(code, name)}
                        style={{
                          default: { fill: fillColor, stroke: "#fff", cursor: "pointer" },
                          hover: { fill: "#fbbf24" },
                          pressed: { fill: "#f59e0b" },
                        }}
                      />
                    );
                  })}

                  {geographies.map((geo) => {
                    const [cx, cy] = geoCentroid(geo);
                    const [px, py] = projection([cx, cy]) || [0, 0];

                    return (
                      <text
                        key={`label-${geo.rsmKey}`}
                        x={px}
                        y={py}
                        textAnchor="middle"
                        fontSize={Math.max(7 / transform.k, 3)}
                        fill="#000"
                        pointerEvents="none"
                      >
                        {geo.properties.nam_ja}
                      </text>
                    );
                  })}
                </>
              );
            }}
          </Geographies>
        </g>
      </ComposableMap>
      {hoveredPref && tooltipPosition && (
        <PrefectureHoverTooltip
          prefCode={hoveredPref.prefCode}
          prefName={hoveredPref.prefName}
          stats={buildPrefStats(hoveredPref.prefCode)}
          position={tooltipPosition}
          isVisible={tooltipVisible}
          onClose={handleCloseTooltip}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  );
}