"use client";

import { useEffect, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { select } from "d3-selection";
import { zoom } from "d3-zoom";
import { geoCentroid } from "d3-geo";

export default function JapanMap({ 
  selectedAreas, 
  onSelect, 
  isPrefectureSelected, 
  getPrefectureColor,
  areaColors,
  colorPalette,
  onLoad 
}) {
  const svgRef = useRef(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 初始化缩放拖拽
  useEffect(() => {
    const svg = select(svgRef.current);
    const zoomBehavior = zoom()
      .scaleExtent([1, 8])
      .on("zoom", (event) => setTransform(event.transform));
    svg.call(zoomBehavior);
  }, []);

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
                    let fillColor = "#60a5fa"; // 默认蓝色
                    
                    if (isSelected) {
                      if (colorId && colorId !== "mixed") {
                        fillColor = colorPalette[colorId];
                      } else if (colorId === "mixed") {
                        fillColor = "#d1d5db"; // 混合颜色显示灰色
                      }
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => onSelect(code, name)}
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
                        fontSize={6 / transform.k}
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
    </div>
  );
}