"use client";
import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { geoCentroid } from "d3-geo";

export default function PrefectureMap({ 
  prefCode, 
  selectedAreas, 
  areaColors,
  colorPalette,
  onSelect, 
  onBack, 
  onLoad 
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const loadedPrefCodeRef = useRef(null);

  // 切换县级地图时重置 transform 和数据加载状态
  useEffect(() => {
    setTransform({ k: 1, x: 0, y: 0 });
    setIsDataLoaded(false);
    loadedPrefCodeRef.current = null;
  }, [prefCode]);

  // 初始化拖拽缩放
  useEffect(() => {
    const svg = select(svgRef.current);
    const zoomBehavior = zoom()
      .scaleExtent([1, 10])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoomBehavior);
  }, [prefCode]);

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
        projectionConfig={{ scale: 2200, center: [139.7, 35.7] }}
        width={800}
        height={600}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <Geographies geography={`/maps/prefecture/${prefCode}.geojson`}>
            {({ geographies, projection }) => {
              if (geographies && geographies.length > 0 && loadedPrefCodeRef.current !== prefCode) {
                const geoJSON = {
                  type: "FeatureCollection",
                  features: geographies
                };
                
                loadedPrefCodeRef.current = prefCode;
                
                setTimeout(() => {
                  if (loadedPrefCodeRef.current === prefCode) {
                    setIsDataLoaded(true);
                    if (onLoad) {
                      console.log("📊 県地図データ読み込み完了:", prefCode);
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
                
                // 根据颜色ID获取填充色
                let fillColor = "#93c5fd"; // 默认浅蓝色
                if (isSelected && colorId) {
                  fillColor = colorPalette[colorId];
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => onSelect(code, name)}
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

              // 文字（最前层）
              const labels = geographies.map((geo) => {
                const name =
                  geo.properties.N03_004 ||
                  geo.properties.N03_003 ||
                  geo.properties.N03_002 ||
                  geo.properties.N03_001;

                if (shownNames.has(name)) return null;
                shownNames.add(name);

                const [cx, cy] = geoCentroid(geo);
                const projected = projection([cx, cy]);
                if (!projected) return null;

                return (
                  <text
                    key={name}
                    x={projected[0]}
                    y={projected[1]}
                    textAnchor="middle"
                    fontSize={6 / transform.k}
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
                  {/* 底层地图 */}
                  {geoList}

                  {/* 顶层文字 */}
                  <g>{labels}</g>
                </>
              );
            }}
          </Geographies>
        </g>
      </ComposableMap>
    </div>
  );
}