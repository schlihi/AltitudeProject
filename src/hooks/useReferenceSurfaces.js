import { useState, useCallback } from 'react';
import { fetchElevation } from '../services/usgsElevationService';

import { loadGeoidGrid, sampleGrid } from '../geodesy/geoidGrid';

// Cache the grid promise outside the hook so it only downloads the .bin file ONCE
let globalGeoidGridPromise = null;

export function useReferenceSurfaces() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [surfaceData, setSurfaceData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectLocation = useCallback(async (lat, lon) => {
    setSelectedLocation({ lat, lon });
    setIsLoading(true);
    setError(null);

    try {
      // 1. Kick off the Grid load if it hasn't happened yet
      if (!globalGeoidGridPromise) {
        console.log("Loading project's custom Geoid binary grid...");
        globalGeoidGridPromise = loadGeoidGrid();
      }

      // 2. Fetch Terrain from USGS AND wait for the Geoid Grid to be ready at the same time
      const [terrainElevation, geoidGrid] = await Promise.all([
        fetchElevation(lat, lon),
        globalGeoidGridPromise
      ]);
      
      // 3. Use the sampleGrid math you just found to get the exact Geoid undulation!
      const geoidUndulation = sampleGrid(geoidGrid, lat, lon);
      
      // 4. Calculate ellipsoid height: h = H + N
      const ellipsoidHeight = (terrainElevation !== null && geoidUndulation !== null)
        ? terrainElevation + geoidUndulation
        : null;

      setSurfaceData({
        lat,
        lon,
        terrainElevation,
        geoidUndulation,
        ellipsoidHeight,
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch surface data');
      setSurfaceData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { selectedLocation, surfaceData, isLoading, error, selectLocation };
}