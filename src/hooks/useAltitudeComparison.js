import { useState, useCallback } from 'react';
import { fetchElevation } from '../services/usgsElevationService';
import { getGeoidUndulation, calculateEllipsoidHeight } from '../geodesy/geoidModel';

export function useAltitudeComparison() {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [altitudeData, setAltitudeData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const selectLocation = useCallback(async (lat, lon) => {
    setSelectedLocation({ lat, lon });
    setIsLoading(true);
    setError(null);

    try {
      // Fetch terrain elevation from USGS
      const terrainElevation = await fetchElevation(lat, lon);
      
      // Calculate geoid undulation (approximation)
      const geoidUndulation = getGeoidUndulation(lat, lon);
      
      // Calculate ellipsoid height: h = H + N
      const ellipsoidHeight = terrainElevation !== null 
        ? calculateEllipsoidHeight(terrainElevation, geoidUndulation)
        : null;

      setAltitudeData({
        lat,
        lon,
        terrainElevation,
        geoidUndulation,
        ellipsoidHeight,
      });
    } catch (err) {
      setError(err.message || 'Failed to fetch altitude data');
      setAltitudeData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLocation(null);
    setAltitudeData(null);
    setError(null);
  }, []);

  return {
    selectedLocation,
    altitudeData,
    isLoading,
    error,
    selectLocation,
    clearSelection,
    // Static content for the info panels
    equation:
      'Ellipsoid height (h) equals the sum of terrain elevation above the geoid (H) and geoid undulation (N): h = H + N',
    referencePoints: [
      'Terrain elevation (H) — Height above Mean Sea Level (geoid)',
      'Geoid undulation (N) — Height of geoid relative to ellipsoid',
      'Ellipsoid height (h) — Height above WGS84 ellipsoid (GPS reports this)',
      'For drones: GPS altitude = ellipsoid height, not terrain altitude',
    ],
  };
}
