import { useState, useCallback } from 'react';
//import { fetchElevationProfile } from '../services/usgsElevationService';
import { fetchElevationProfile } from '../services/openMeteoElevationService';

let globalGeoidGridPromise = null;

export function useReferenceSurfaces() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [surfaceData, setSurfaceData] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);


  const selectLocation = useCallback(async (lat, lon, widthKm = 5) => {
    setSelectedLocation({ lat, lon });
    setIsLoading(true);
    setError(null);

    try {
      if (!globalGeoidGridPromise) {
        globalGeoidGridPromise = loadGeoidGrid();
      }

      const latRad = lat * (Math.PI / 180);
      const lonOffset = (widthKm / 2) / (111.32 * Math.cos(latRad)); 
      const startLon = lon - lonOffset;
      const endLon = lon + lonOffset;

      const [profile, geoidGrid] = await Promise.all([
        fetchElevationProfile(lat, startLon, lat, endLon, 100),
        globalGeoidGridPromise
      ]);

      const pathData = profile.map(p => {
        const N = sampleGrid(geoidGrid, p.lat, p.lon);
        return {
          distance: p.distance, 
          lat: p.lat,
          lon: p.lon,
          H: p.elevation,       
          N: N                  
        };
      });

      setSurfaceData(pathData);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch flight path data');
      setSurfaceData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { selectedLocation, surfaceData, isLoading, error, selectLocation };
}


const GEOID_DATA_URL = `${import.meta.env.BASE_URL}data/`;

async function loadGeoidGrid(baseUrl = GEOID_DATA_URL, { signal } = {}) {
  const metaRes = await fetch(`${baseUrl}geoid.json`, { signal });
  if (!metaRes.ok) throw new Error(`Could not load geoid.json`);
  const meta = await metaRes.json();
  const binRes = await fetch(`${baseUrl}geoid_f32.bin`, { signal });
  if (!binRes.ok) throw new Error(`Could not load geoid_f32.bin`);
  const data = new Float32Array(await binRes.arrayBuffer());
  return { ...meta, data };
}

function sampleGrid(grid, latDeg, lonDeg) {
  const { nlat, nlon, lat0, dlat, lon0, dlon, data } = grid;
  const y = Math.min(Math.max((latDeg - lat0) / dlat, 0), nlat - 1);
  const ring = nlon - 1; 
  const x = ((((lonDeg - lon0) % 360) + 360) % 360) / dlon;
  const i0 = Math.min(Math.floor(y), nlat - 2);
  const fy = y - i0;
  const j0 = Math.floor(x) % ring;
  const fx = x - Math.floor(x);
  const j1 = (j0 + 1) % ring;
  const r0 = i0 * nlon;
  const r1 = (i0 + 1) * nlon;
  const top = data[r0 + j0] * (1 - fx) + data[r0 + j1] * fx;
  const bot = data[r1 + j0] * (1 - fx) + data[r1 + j1] * fx;
  return top * (1 - fy) + bot * fy;
}