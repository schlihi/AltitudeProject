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

const DEG = Math.PI / 180;

/**
 * Point at geodetic (lat, lon) degrees and ellipsoidal height h, on an ellipsoid scaled so the
 * equatorial radius is 1 (h is also in equatorial radii). Returned in Three.js-style Y-up coords:
 * ECEF (x, y, z) -> (x, z, -y), a proper rotation that keeps handedness.
 */
export function geodeticToUnitEllipsoid(latDeg, lonDeg, h = 0, out = [0, 0, 0]) {
  const phi = latDeg * DEG;
  const lam = lonDeg * DEG;
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  const Nr = 1 / Math.sqrt(1 - WGS84_E2 * s * s); // prime-vertical radius of curvature
  const x = (Nr + h) * c * Math.cos(lam);
  const y = (Nr + h) * c * Math.sin(lam);
  const z = (Nr * (1 - WGS84_E2) + h) * s;
  out[0] = x;
  out[1] = z;
  out[2] = -y;
  return out;
}

/** Outward ellipsoid normal at geodetic (lat, lon) degrees, in the same Y-up coords. */
export function geodeticNormal(latDeg, lonDeg, out = [0, 0, 0]) {
  const phi = latDeg * DEG;
  const lam = lonDeg * DEG;
  const c = Math.cos(phi);
  out[0] = c * Math.cos(lam);
  out[1] = Math.sin(phi);
  out[2] = -c * Math.sin(lam);
  return out;
}
