/**
 * Simplified geoid undulation model for the continental U.S.
 * 
 * In reality, GEOID18 or EGM2008 would provide precise values from a grid.
 * This approximation captures the general pattern: negative in the east/southeast,
 * negative in the west, with the most negative values in the Gulf region.
 * 
 * Actual GEOID18 values for the U.S. range roughly from -52m to +5m.
 */

// Approximate geoid undulation (N) based on a simplified model for CONUS
// Real applications should use GEOID18 grid data or NGS API
export function getGeoidUndulation(lat, lon) {
  // Base undulation varies by region
  // Eastern US: -25 to -35m
  // Central US: -25 to -35m  
  // Western US: -20 to -30m
  // Gulf coast: -25 to -30m
  
  // Simplified polynomial approximation for continental US
  // Centered around lat 39, lon -98 (center of CONUS)
  const latOffset = lat - 39;
  const lonOffset = lon + 98;
  
  // Base value around -28m (typical for central US)
  let N = -28;
  
  // Longitude variation: slightly less negative toward Pacific
  N += lonOffset * 0.15;
  
  // Latitude variation: more negative in the south
  N -= latOffset * 0.3;
  
  // Regional adjustment for Gulf of Mexico area (more negative)
  if (lat < 32 && lon > -100 && lon < -80) {
    N -= 5;
  }
  
  // Pacific Northwest adjustment
  if (lat > 42 && lon < -115) {
    N += 8;
  }
  
  // Clamp to realistic range for CONUS
  return Math.max(-52, Math.min(5, N));
}

/**
 * Calculate ellipsoid height from terrain elevation and geoid undulation.
 * h = H + N (approximately, for most practical purposes)
 * 
 * @param {number} terrainElevation - Orthometric height H (meters above geoid/MSL)
 * @param {number} geoidUndulation - Geoid undulation N (meters)
 * @returns {number} Ellipsoid height h (meters above WGS84 ellipsoid)
 */
export function calculateEllipsoidHeight(terrainElevation, geoidUndulation) {
  return terrainElevation + geoidUndulation;
}
