"use client";
import { useRef } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import useMapZoom from "./useMapZoom";
import useMapData from "./useMapData";
import { geoPath } from "d3-geo";

export default function PrefectureMap({
  prefCode,
  prefName,
  selectedAreas,
  areaColors,
  colorPalette,
  onSelect,
  onBack,
  onLoad,
  onAreaDetails,
}) {
  const svgRef = useRef(null);
  const { transform, zoomIn: handleZoomIn, zoomOut: handleZoomOut } = useMapZoom(svgRef, prefCode);
  const { data, error } = useMapData("/maps/prefecture/" + prefCode + ".json", onLoad, true);
  const mapConfig = data?.mapConfig || { scale: 2200, center: [139.7, 35.7] };

  // A single activation opens details and toggles coloring in the same event.
  const handleAreaClick = (name, code) => {
    if (!code) return;
    onAreaDetails?.({ name, code, prefName });
    onSelect(code, name);
  };

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

      {error && <p role="alert">{error}</p>}
      {/* Keep the canvas scale tied to the page width; the sidebar only narrows its viewport. */}
      <div className="relative h-full w-full overflow-hidden" data-map-viewport>
      <ComposableMap
        ref={svgRef}
        className="absolute left-1/2 top-0 -translate-x-1/2 max-w-none"
        style={{ width: "max(calc(320px - 2rem - 6px), calc(100cqw - var(--population-info-width, 420px) - 3rem - 6px))", height: "auto" }}
        projection="geoMercator"
        projectionConfig={{
          scale: mapConfig.scale,
          center: mapConfig.center
        }}
        width={800}
        height={600}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <Geographies geography={data?.geoJSON || { type: "FeatureCollection", features: [] }}>
            {({ geographies, projection }) => {
              const shownNames = new Set();

              // 区域块（底层）
              const geoList = geographies.map((geo) => {
                const code = geo.properties.N03_007;
                const name =
                  geo.properties.N03_004 ||
                  geo.properties.N03_003 ||
                  geo.properties.N03_002 ||
                  geo.properties.N03_001;

                const isSelected = selectedAreas.includes(code) || selectedAreas.includes(prefCode + '000');
                const colorId = areaColors[code] || areaColors[prefCode + '000'];

                let fillColor = "#e7e7e7";
                if (isSelected && colorId) {
                  fillColor = colorPalette[colorId];
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    role="button"
                    aria-label={`${name}を選択`}
                    aria-pressed={isSelected}
                    tabIndex={0}
                    onClick={() => handleAreaClick(name, code)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleAreaClick(name, code);
                      }
                    }}
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
      </div>

    </div>
  );
}
