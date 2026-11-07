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
