/**
 * Global geoid-height grid (N above the WGS84 ellipsoid, metres), produced by
 * scripts/preprocess_geoid.py and served from public/data/.
 *
 * Grid shape: { nlat, nlon, lat0, dlat, lon0, dlon, min, max, poi, model, data: Float32Array }
 * Rows run lat0 + i*dlat (north -> south); columns lon0 + j*dlon, with the last column
 * duplicating the first so a mesh seam closes.
 */

export const GEOID_DATA_URL = `${import.meta.env.BASE_URL}data/`;

export async function loadGeoidGrid(baseUrl = GEOID_DATA_URL, { signal } = {}) {
  const metaRes = await fetch(`${baseUrl}geoid.json`, { signal });
  if (!metaRes.ok) {
    throw new Error(
      `Could not load ${baseUrl}geoid.json (${metaRes.status}). Run scripts/preprocess_geoid.py first.`,
    );
  }
  const meta = await metaRes.json();
  const binRes = await fetch(`${baseUrl}geoid_f32.bin`, { signal });
  if (!binRes.ok) throw new Error(`Could not load ${baseUrl}geoid_f32.bin (${binRes.status}).`);
  const data = new Float32Array(await binRes.arrayBuffer());
  if (data.length !== meta.nlat * meta.nlon) {
    throw new Error(`geoid_f32.bin has ${data.length} values; expected ${meta.nlat}x${meta.nlon}.`);
  }
  return { ...meta, data };
}

/** Bilinear sample of the geoid grid (metres) at any lat/lon. Wraps in longitude. */
export function sampleGrid(grid, latDeg, lonDeg) {
  const { nlat, nlon, lat0, dlat, lon0, dlon, data } = grid;
  const y = Math.min(Math.max((latDeg - lat0) / dlat, 0), nlat - 1);
  const ring = nlon - 1; // last column duplicates the first
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
