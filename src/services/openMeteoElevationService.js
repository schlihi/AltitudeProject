/**
 * Fetches elevation for a single latitude/longitude from Open-Meteo.
 */
export async function fetchElevation(lat, lon) {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.reason);

  return data.elevation[0] ?? null;
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
 * Fetches elevation profile along a line using ONE single Open-Meteo request!
 */
export async function fetchElevationProfile(startLat, startLon, endLat, endLon, numPoints = 50) {
  const points = [];
  
  for (let i = 0; i < numPoints; i++) {
    const t = i / (numPoints - 1);
    const lat = startLat + t * (endLat - startLat);
    const lon = startLon + t * (endLon - startLon);
    const distance = haversineDistance(startLat, startLon, lat, lon);
    points.push({ lat, lon, distance, elevation: null });
  }

  // Format them into comma-separated strings
  const latsString = points.map(p => p.lat.toFixed(6)).join(',');
  const lonsString = points.map(p => p.lon.toFixed(6)).join(',');

  const url = `https://api.open-meteo.com/v1/elevation?latitude=${latsString}&longitude=${lonsString}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo API error: ${response.status}`);
    
    const data = await response.json();
    if (data.error) throw new Error(data.reason);

    // Match the returned array of elevations back to our points
    if (data.elevation && Array.isArray(data.elevation)) {
      for (let i = 0; i < points.length; i++) {
        points[i].elevation = data.elevation[i];
      }
    }
  } catch (err) {
    console.error("Failed to fetch elevation profile:", err);
  }

  return points;
}

export function getTotalDistance(startLat, startLon, endLat, endLon) {
  return haversineDistance(startLat, startLon, endLat, endLon) / 1000;
}