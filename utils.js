import { uniqueNamesGenerator, adjectives, animals, NumberDictionary } from 'unique-names-generator';
import { feature as topoFeature } from 'topojson-client';
import { geoPath } from 'd3-geo';

/*
Get the actual size of a resource downloaded by the browser (e.g. an image) in bytes.
This is supported in recent versions of all major browsers, with some caveats.
See https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/encodedBodySize
*/
export function getResourceSize(url) {
    const entry = window?.performance?.getEntriesByName(url)?.[0];
    if (entry) {
        const size = entry?.encodedBodySize;
        return size || undefined;
    } else {
        return undefined;
    }
}

// Note: this only works on the server side
export function getNetlifyContext() {
    return process.env.CONTEXT;
}

export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
}

const uniqueNamesConfig = {
    dictionaries: [adjectives, animals],
    separator: '-',
    length: 2
};

export function uniqueName() {
    return uniqueNamesGenerator(uniqueNamesConfig) + "-" + randomInt(100, 999);
}

export const uploadDisabled = process.env.NEXT_PUBLIC_DISABLE_UPLOADS?.toLowerCase() === "true";

export const EMU_PER_INCH = 914400;

export function topoToGeoFeatures(topology) {
    const objectKey = Object.keys(topology.objects || {})[0];
    if (!objectKey) throw new Error("TopoJSON objects が見つかりません");

    const fc = topoFeature(topology, topology.objects[objectKey]);
    if (!fc?.features) throw new Error("FeatureCollection 変換失敗");

    return fc;
}

export function getFeatureMeta(feature) {
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
}

export function extractProjectedPolygons(feature, projection) {
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
}

export function computePolygonBounds(polygons) {
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
}

export function normalizeHex(hex) {
    return String(hex || "#E7E7E7").replace("#", "").toUpperCase();
}

export function escapeXml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

export function buildRegionShapeXml({
    feature,
    polygons,
    index,
    slideScaleX,
    slideScaleY,
    getFeatureFillHex,
}) {
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
}

export function buildLabelShapeXml({
    feature,
    projection,
    slideScaleX,
    slideScaleY,
    offsetXPx = 0,
    offsetYPx = 0,
    index,
}) {
    const meta = getFeatureMeta(feature);
    const pathGenerator = geoPath().projection(projection);
    const centroid = pathGenerator.centroid(feature);

    if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return "";

    const xPx = centroid[0] + meta.labelOffsetX + offsetXPx;
    const yPx = centroid[1] + meta.labelOffsetY + offsetYPx;

    const xEmu = Math.round(xPx * slideScaleX);
    const yEmu = Math.round(yPx * slideScaleY);

    const text = String(meta.name || "");
    const PT_TO_EMU = 12700;
    const fontSizePt = 7; // 因为 a:rPr 的 sz="700" = 7pt

    const fullWidthCount = (text.match(/[\u3000-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/g) || []).length;
    const halfWidthCount = text.length - fullWidthCount;

    // 日文/中文按接近全角宽度，英数按半角宽度估算
    const textWidthPt =
        fullWidthCount * fontSizePt * 1.02 +
        halfWidthCount * fontSizePt * 0.56;

    // 只保留极小边距，尽量贴合文字
    const padXPt = 1.5;
    const padYPt = 1;

    const wEmu = Math.max(1, Math.round((textWidthPt + padXPt * 2) * PT_TO_EMU));
    const hEmu = Math.max(1, Math.round((fontSizePt * 1.08 + padYPt * 2) * PT_TO_EMU));

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
}

export function downloadZipcodeCSV({ filename, rows }) {
    if (!rows || rows.length === 0) return;

    const headers = ["タイプ", "郵便番号", "市区町村", "地域"];

    const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
            row.map((cell) => `"${cell ?? ""}"`).join(",")
        ),
    ].join("\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], {
        type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}