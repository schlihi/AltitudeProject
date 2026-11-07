const USGS_ELEVATION_URL = 'https://epqs.nationalmap.gov/v1/json';

/**
 * Fetches elevation (terrain height) for a given latitude/longitude from USGS National Map.
 * Returns elevation in meters as a number, or null if no data.
 */
export async function fetchElevation(lat, lon) {
  const params = new URLSearchParams({
    x: lon.toString(),
    y: lat.toString(),
    units: 'Meters',
    wkid: '4326',
    includeDate: 'false',
  });

  const response = await fetch(`${USGS_ELEVATION_URL}?${params}`);
  
  if (!response.ok) {
    throw new Error(`USGS API error: ${response.status}`);
  }

  const data = await response.json();
  
  // API may return value in different formats
  const rawValue = data.value;
  
  if (rawValue === undefined || rawValue === null || rawValue === -1000000 || rawValue === '-1000000') {
    return null; // No data for this location (likely ocean or outside coverage)
  }

  // Ensure we return a number
  const elevation = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
  
  if (isNaN(elevation)) {
    return null;
  }

  return elevation;
}

/**
 * Calculate distance between two points in meters using Haversine formula
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetches elevation profile along a line between two points.
 * Returns an array of { distance, elevation, lat, lon } objects.
 * @param {number} startLat - Starting latitude
 * @param {number} startLon - Starting longitude
 * @param {number} endLat - Ending latitude
 * @param {number} endLon - Ending longitude
 * @param {number} numPoints - Number of sample points (default 50)
 */
export async function fetchElevationProfile(startLat, startLon, endLat, endLon, numPoints = 50) {
  const points = [];
  
  // Generate points along the line
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    const distance = haversineDistance(startLat, startLon, lat, lon);
    points.push({ lat, lon, distance, elevation: null });
  }

  // Fetch elevations in batches to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 100; // ms between batches
  
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (point, idx) => {
      try {
        const elevation = await fetchElevation(point.lat, point.lon);
        points[i + idx].elevation = elevation;
      } catch (err) {
        console.warn(`Failed to fetch elevation for point ${i + idx}:`, err);
        points[i + idx].elevation = null;
      }
    });
    
    await Promise.all(promises);
    
    // Small delay between batches to be respectful to the API
    if (i + BATCH_SIZE < points.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return points;
}

/**
 * Get the total distance between two points in kilometers
 */
export function getTotalDistance(startLat, startLon, endLat, endLon) {
  return haversineDistance(startLat, startLon, endLat, endLon) / 1000;
}
