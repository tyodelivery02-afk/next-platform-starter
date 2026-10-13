import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';

export default function useMapZoom(svgRef, resetKey) {
  const [transform, setTransform] = useState(zoomIdentity);
  const behaviorRef = useRef(null);
  useEffect(() => {
    const svg = select(svgRef.current);
    const behavior = zoom().scaleExtent([1, 10]).on('zoom', event => setTransform(event.transform));
    behaviorRef.current = behavior;
    svg.call(behavior).call(behavior.transform, zoomIdentity);
    return () => { svg.on('.zoom', null); behaviorRef.current = null; };
  }, [svgRef, resetKey]);
  const changeZoom = delta => {
    if (behaviorRef.current) select(svgRef.current).call(behaviorRef.current.scaleTo, Math.max(1, Math.min(10, transform.k + delta)));
  };
  return { transform, zoomIn: () => changeZoom(0.2), zoomOut: () => changeZoom(-0.2) };
}
