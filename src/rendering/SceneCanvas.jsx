import { useEffect, useRef } from 'react';
import { createGeoidGlobe } from './geoidGlobe';

/**
 * Mounts the Three.js geoid globe for a loaded grid. The imperative globe API is handed to the
 * parent through `onReady(api)` (and `onReady(null)` on teardown).
 */
export default function SceneCanvas({ grid, coastlines, onReady, onKChange }) {
  const containerRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onKChangeRef = useRef(onKChange);
  onReadyRef.current = onReady;
  onKChangeRef.current = onKChange;

  useEffect(() => {
    if (!grid || !containerRef.current) return undefined;
    const globe = createGeoidGlobe(containerRef.current, grid, {
      coastlines,
      onKChange: (k, t) => onKChangeRef.current?.(k, t),
    });
    onReadyRef.current?.(globe);
    return () => {
      onReadyRef.current?.(null);
      globe.dispose();
    };
  }, [grid, coastlines]);

  return <div ref={containerRef} className="globe-canvas" />;
}
