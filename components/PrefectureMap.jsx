"use client";
import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { geoPath } from "d3-geo";
import ZipcodeTooltip from "./ZipcodeTooltip";

export default function PrefectureMap({
  prefCode,
  prefName,
  selectedAreas,
  areaColors,
  colorPalette,
  onSelect,
  onBack,
  onLoad,
  housingCache = {},
  onFetchHousing,
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [mapConfig, setMapConfig] = useState({
    scale: 2200,
    center: [139.7, 35.7]
  });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const loadedPrefCodeRef = useRef(null);
  const pendingConfigRef = useRef(null);

  // 邮编tooltip相关状态
  const [hoveredArea, setHoveredArea] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const hoverOpenTimerRef = useRef(null);  // 防抖：防止快速扫过触发
  const closeTimerRef = useRef(null);       // 猶予：允许光标移到 Tooltip
  const unmountTimerRef = useRef(null);     // 等待淡出动画完成再 unmount

  // 切换县级地图时重置 transform 和数据加载状态
  useEffect(() => {
    setTransform({ k: 1, x: 0, y: 0 });
    setIsDataLoaded(false);
    loadedPrefCodeRef.current = null;
    setMapConfig({ scale: 2200, center: [139.7, 35.7] });
    // 清除tooltip
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    setTooltipVisible(false);
    setHoveredArea(null);
    setTooltipPosition(null);
  }, [prefCode]);

  // 专门处理配置更新的 Effect
  useEffect(() => {
    if (isDataLoaded && pendingConfigRef.current) {
      setMapConfig(pendingConfigRef.current);
      pendingConfigRef.current = null;
    }
  }, [isDataLoaded]);

  // 初始化拖拽缩放
  useEffect(() => {
    const svg = select(svgRef.current);
    const zoomBehavior = zoom()
      .scaleExtent([1, 10])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoomBehavior);
  }, [prefCode]);

  // 清理timeout
  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    };
  }, []);

  // 处理鼠标进入区域
  const handleMouseEnter = (event, areaName, areaCode) => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    // 如果 tooltip 正在关闭中，取消关闭
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);

    hoverOpenTimerRef.current = setTimeout(() => {
      if (onFetchHousing) onFetchHousing(areaCode); // ホバー時にprefetch
      setHoveredArea({ name: areaName, code: areaCode, prefName: prefName || "" });
      setTooltipPosition({ x: event.clientX, y: event.clientY });
      setTooltipVisible(false); // 先设为不可见，下一帧再触发动画
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTooltipVisible(true));
      });
    }, 250);
  };

  // 处理鼠标离开区域
  const handleMouseLeave = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    // 150ms 猶予：在此时间内移入 Tooltip 可取消关闭
    closeTimerRef.current = setTimeout(() => {
      setTooltipVisible(false); // 触发淡出动画
      unmountTimerRef.current = setTimeout(() => {
        setHoveredArea(null);
        setTooltipPosition(null);
      }, 220); // 等动画跑完(200ms)再移除DOM
    }, 150);
  };

  // 关闭tooltip
  const handleCloseTooltip = () => {
    if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    setTooltipVisible(false);
    unmountTimerRef.current = setTimeout(() => {
      setHoveredArea(null);
      setTooltipPosition(null);
    }, 220);
  };

  // 鼠标进入 Tooltip 时，取消关闭
  const handleTooltipMouseEnter = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
  };

  // 鼠标离开 Tooltip 时，重新启动关闭流程
  const handleTooltipMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setTooltipVisible(false);
      unmountTimerRef.current = setTimeout(() => {
        setHoveredArea(null);
        setTooltipPosition(null);
      }, 220);
    }, 150);
  };

  // 放大/缩小按钮
  const handleZoomIn = () => setTransform((t) => ({ ...t, k: Math.min(t.k + 0.2, 10) }));
  const handleZoomOut = () => setTransform((t) => ({ ...t, k: Math.max(t.k - 0.2, 1) }));

  if (!prefCode) return <div>都道府県を選択してください。</div>;

  return (
    <div className="relative border-2 border-gray-400 rounded-lg p-2 w-full h-full">
      <style jsx>{`
        .rsm-geography:focus {
          outline: none;
        }
      `}</style>

      {/* 返回全国地图按钮 */}
      <button
        onClick={onBack}
        className="absolute orther-button"
      >
        全国地図
      </button>

      {/* 缩放按钮 */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button
          onClick={handleZoomIn}
          className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100"
        >
          -
        </button>
      </div>

      <ComposableMap
        ref={svgRef}
        projection="geoMercator"
        projectionConfig={{
          scale: mapConfig.scale,
          center: mapConfig.center
        }}
        width={800}
        height={600}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <Geographies geography={`/maps/prefecture/${prefCode}.json`}>
            {({ geographies, projection }) => {
              if (geographies && geographies.length > 0 && loadedPrefCodeRef.current !== prefCode) {
                const firstGeo = geographies[0];
                if (firstGeo && firstGeo.properties) {
                  const customScale = firstGeo.properties.map_scale;
                  const customCenter = firstGeo.properties.map_center;

                  if (customScale || customCenter) {
                    pendingConfigRef.current = {
                      scale: Number(customScale) || 2200,
                      center: customCenter || [139.7, 35.7]
                    };
                  }
                }

                const geoJSON = { type: "FeatureCollection", features: geographies };
                loadedPrefCodeRef.current = prefCode;

                setTimeout(() => {
                  if (loadedPrefCodeRef.current === prefCode) {
                    setIsDataLoaded(true);
                    if (onLoad) {
                      console.log("県地図読込完成:", prefCode);
                      onLoad(geoJSON);
                    }
                  }
                }, 0);
              }

              const shownNames = new Set();

              // 区域块（底层）
              const geoList = geographies.map((geo) => {
                const code = geo.properties.N03_007;
                const name =
                  geo.properties.N03_004 ||
                  geo.properties.N03_003 ||
                  geo.properties.N03_002 ||
                  geo.properties.N03_001;

                const isSelected = selectedAreas.includes(code);
                const colorId = areaColors[code];

                let fillColor = "#e7e7e7";
                if (isSelected && colorId) {
                  fillColor = colorPalette[colorId];
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onSelect(code, name)}
                    onMouseEnter={(event) => handleMouseEnter(event, name, code)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      default: {
                        fill: fillColor,
                        stroke: "#fff",
                        strokeWidth: 0.5,
                        cursor: "pointer",
                      },
                      hover: { fill: "#fbbf24" },
                      pressed: { fill: "#f59e0b" },
                    }}
                  />
                );
              });

              // 文字(最前层)
              const pathGenerator = geoPath().projection(projection);
              const labels = geographies.map((geo) => {
                const name =
                  geo.properties.N03_004 ||
                  geo.properties.N03_003 ||
                  geo.properties.N03_002 ||
                  geo.properties.N03_001;

                if (shownNames.has(name)) return null;
                shownNames.add(name);

                const centroid = pathGenerator.centroid(geo);
                if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return null;

                const offsetX = geo.properties.label_offset_x || 0;
                const offsetY = geo.properties.label_offset_y || 0;

                return (
                  <text
                    key={name}
                    x={centroid[0] + offsetX}
                    y={centroid[1] + offsetY}
                    textAnchor="middle"
                    fontSize={Math.max(7 / transform.k, 3)}
                    fill="#111"
                    pointerEvents="none"
                    style={{ userSelect: "none" }}
                  >
                    {name}
                  </text>
                );
              });

              return (
                <>
                  {geoList}
                  <g>{labels}</g>
                </>
              );
            }}
          </Geographies>
        </g>
      </ComposableMap>

      {/* 邮编信息Tooltip */}
      {hoveredArea && tooltipPosition && (
        <ZipcodeTooltip
          areaName={hoveredArea.name}
          areaCode={hoveredArea.code}
          position={tooltipPosition}
          isVisible={tooltipVisible}
          housingData={housingCache[hoveredArea.code]}
          onClose={handleCloseTooltip}
          onMouseEnter={handleTooltipMouseEnter}
          onMouseLeave={handleTooltipMouseLeave}
        />
      )}
    </div>
  );
}