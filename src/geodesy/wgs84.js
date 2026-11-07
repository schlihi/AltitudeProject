/**
 * WGS84 Ellipsoid Constants
 * Reference: NIMA TR8350.2 (World Geodetic System 1984)
 */

// Semi-major axis (equatorial radius) in meters
export const WGS84_A = 6378137.0;

// Flattening
export const WGS84_F = 1 / 298.257223563;

// Semi-minor axis (polar radius) in meters
export const WGS84_B = WGS84_A * (1 - WGS84_F);

// First eccentricity squared
export const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;

/**
 * Calculate the radius of the WGS84 ellipsoid at a given latitude.
 * @param {number} lat - Latitude in degrees
 * @returns {number} Radius in meters
 */
export function getEllipsoidRadius(lat) {
  const latRad = (lat * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const cosLat = Math.cos(latRad);
  
  const numerator = (WGS84_A * WGS84_A * cosLat) ** 2 + (WGS84_B * WGS84_B * sinLat) ** 2;
  const denominator = (WGS84_A * cosLat) ** 2 + (WGS84_B * sinLat) ** 2;
  
  return Math.sqrt(numerator / denominator);
}
