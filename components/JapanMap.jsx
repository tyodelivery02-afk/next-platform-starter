"use client";

import { useRef } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import useMapZoom from "./useMapZoom";
import useMapData from "./useMapData";
import { geoCentroid } from "d3-geo";

export default function JapanMap({
  onPrefectureClick,
  isPrefectureSelected,
  activePanelPrefCode,
  getPrefectureColor,
  onLoad,
}) {
  const svgRef = useRef(null);
  const { transform, zoomIn: handleZoomIn, zoomOut: handleZoomOut } = useMapZoom(svgRef, null);
  const { data, error } = useMapData("/maps/japan-prefectures.geojson", onLoad);

  const handlePrefectureClick = (prefCode, prefName) => {
    if (!onPrefectureClick) return;

    onPrefectureClick({
      prefCode,
      prefName,
    });
  };

  return (
    <div className="relative border-2 border-gray-400 rounded-lg p-2 w-full h-full">
      {/* 缩放按钮 */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
        <button onClick={handleZoomIn} className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100">+</button>
        <button onClick={handleZoomOut} className="bg-white border rounded px-2 py-1 shadow hover:bg-gray-100">-</button>
      </div>

      {error && <p role="alert">{error}</p>}
      {/* 地图 */}
      <ComposableMap
        ref={svgRef}
        projection="geoMercator"
        projectionConfig={{ scale: 1200, center: [137, 37] }}
        width={800}
        height={600}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <Geographies geography={data?.geoJSON || { type: "FeatureCollection", features: [] }}>
            {({ geographies, projection }) => {
              return (
                <>
                  {geographies.map((geo) => {
                    const code = geo.properties.id;
                    const name = geo.properties.nam_ja;
                    const prefCode = code.substring(0, 2);
                    const isSelected = isPrefectureSelected(prefCode);

                    // 有选中区域的都道府县统一显示红色，单色和混合色使用相同标记
                    const colorId = getPrefectureColor(prefCode);
                    let fillColor = "#e7e7e7";

                    if (isSelected) {
                      if (colorId && colorId !== "mixed") {
                        fillColor = "#ec2424";
                      } else if (colorId === "mixed") {
                        fillColor = "#ec2424";
                      }
                    }

                    if (activePanelPrefCode === prefCode) {
                      fillColor = "#ff58b4";
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        role="button"
                        aria-label={`${name}の統計`}
                        aria-pressed={activePanelPrefCode === prefCode}
                        tabIndex={0}
                        onClick={() => handlePrefectureClick(prefCode, name)}
                        onKeyDown={event => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handlePrefectureClick(prefCode, name);
                          }
                        }}
                        style={{
                          default: { fill: fillColor, stroke: "#fff", cursor: "default" },
                          hover: { fill: "#fbbf24", cursor: "pointer" },
                          pressed: { fill: "#f59e0b", cursor: "pointer" },
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
    </div>
  );
}
