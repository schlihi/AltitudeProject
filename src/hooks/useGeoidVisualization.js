import { useCallback, useEffect, useRef, useState } from 'react';
import { GEOID_DATA_URL, loadGeoidGrid } from '../geodesy/geoidGrid';
import { K_STOPS } from '../rendering/geoidGlobe';
import { geojsonPolylines } from '../rendering/globeGeometry';

const CAMERA_KEYS = { g: 'global', l: 'low', h: 'high', m: 'mv' };

async function loadCoastlines(signal) {
  try {
    const res = await fetch(`${GEOID_DATA_URL}ne_110m_coastline.geojson`, { signal });
    if (!res.ok) return null;
    return geojsonPolylines(await res.json());
  } catch {
    return null; // optional layer; the dev server may answer a missing file with index.html
  }
}

/**
 * Loads the geoid grid and holds the UI state for the globe. The globe itself is mounted by
 * SceneCanvas, which reports its API through `onGlobeReady`.
 */
export function useGeoidVisualization() {
  const [grid, setGrid] = useState(null);
  const [coastlines, setCoastlines] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [exaggeration, setExaggeration] = useState({ k: 1, t: 0 });
  const [layers, setLayers] = useState({ coast: true, graticule: true, fill: true, labels: true });
  const globeRef = useRef(null);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadGeoidGrid(undefined, { signal: controller.signal }), loadCoastlines(controller.signal)])
      .then(([g, coast]) => {
        setCoastlines(coast);
        setGrid(g);
        setStatus('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(err.message);
        setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const onGlobeReady = useCallback((api) => {
    globeRef.current = api;
    if (!api) return;
    for (const [name, visible] of Object.entries(layersRef.current)) api.setLayerVisible(name, visible);
  }, []);

  const onKChange = useCallback((k, t) => setExaggeration({ k, t }), []);

  const setSliderT = useCallback((t) => globeRef.current?.setT(t), []);
  const animateToK = useCallback((k) => globeRef.current?.animateToK(k), []);
  const flyTo = useCallback((name) => globeRef.current?.flyTo(name), []);
  const setLayerVisible = useCallback((name, visible) => {
    setLayers((prev) => ({ ...prev, [name]: visible }));
    globeRef.current?.setLayerVisible(name, visible);
  }, []);

  // Keyboard shortcuts: 1-5 exaggeration stops, G/L/H/M camera presets.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox'].includes(e.target.type))) return;
      const n = Number(e.key);
      if (n >= 1 && n <= K_STOPS.length) animateToK(K_STOPS[n - 1]);
      const preset = CAMERA_KEYS[e.key.toLowerCase()];
      if (preset) flyTo(preset);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [animateToK, flyTo]);

  return {
    grid,
    coastlines,
    status,
    error,
    k: exaggeration.k,
    t: exaggeration.t,
    layers,
    onGlobeReady,
    onKChange,
    setSliderT,
    animateToK,
    flyTo,
    setLayerVisible,
  };
}
