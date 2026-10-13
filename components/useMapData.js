import { useEffect, useRef, useState } from 'react';
import { fetchPopulationJSON } from '../lib/population-client.mjs';
import { topoToGeoFeatures } from '../utils';

export default function useMapData(url, onLoad, prefecture = false) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchPopulationJSON(url).then(raw => {
      if (cancelled) return;
      const geoJSON = raw.type === 'FeatureCollection' ? raw : topoToGeoFeatures(raw);
      if (!geoJSON?.features?.length) throw new Error('地図データが空です');
      const props = geoJSON.features[0].properties || {};
      const scale = Number(props.map_scale);
      const mapConfig = {
        scale: Number.isFinite(scale) && scale > 0 ? scale : 2200,
        center: Array.isArray(props.map_center) && props.map_center.length === 2 ? props.map_center : [139.7, 35.7],
      };
      setData({ geoJSON, mapConfig });
      onLoadRef.current?.(prefecture ? { geoJSON, mapConfig } : geoJSON);
    }).catch(error => { if (!cancelled) setError(error.message); });
    return () => { cancelled = true; };
  }, [url, prefecture]);
  return { data, error };
}
