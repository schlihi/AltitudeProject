// Pure geometry helpers (no Three.js dependency) so they can be unit-tested in Node.
// Units: lengths in equatorial radii (a = 1). Coordinates are Three.js-style, Y-up:
// ECEF (x, y, z) -> Three (x, z, -y), which is a proper rotation (keeps handedness).

export const WGS84 = { a: 6378137.0, f: 1 / 298.257223563 };
export const E2 = WGS84.f * (2 - WGS84.f);
const DEG = Math.PI / 180;

/** Point at geodetic (lat, lon) degrees and ellipsoidal height h (in radii), in Three coords. */
export function geodeticToThree(latDeg, lonDeg, h = 0, out = [0, 0, 0]) {
  const phi = latDeg * DEG, lam = lonDeg * DEG;
  const s = Math.sin(phi), c = Math.cos(phi);
  const Nr = 1 / Math.sqrt(1 - E2 * s * s); // prime-vertical radius of curvature
  const x = (Nr + h) * c * Math.cos(lam);
  const y = (Nr + h) * c * Math.sin(lam);
  const z = (Nr * (1 - E2) + h) * s;
  out[0] = x; out[1] = z; out[2] = -y;
  return out;
}

/** Outward ellipsoid normal at geodetic (lat, lon), in Three coords. Exact on a geodetic grid. */
export function geodeticNormalThree(latDeg, lonDeg, out = [0, 0, 0]) {
  const phi = latDeg * DEG, lam = lonDeg * DEG;
  const c = Math.cos(phi);
  out[0] = c * Math.cos(lam); out[1] = Math.sin(phi); out[2] = -c * Math.sin(lam);
  return out;
}

/** Bilinear sample of the geoid grid (metres) at any lat/lon. Wraps in longitude. */
export function sampleGrid(grid, latDeg, lonDeg) {
  const { nlat, nlon, lat0, dlat, lon0, dlon, data } = grid;
  const y = Math.min(Math.max((latDeg - lat0) / dlat, 0), nlat - 1);
  const ring = nlon - 1; // last column duplicates the first
  let x = (((lonDeg - lon0) % 360) + 360) % 360 / dlon;
  const i0 = Math.min(Math.floor(y), nlat - 2), fy = y - i0;
  const j0 = Math.floor(x) % ring, fx = x - Math.floor(x), j1 = (j0 + 1) % ring;
  const r0 = i0 * nlon, r1 = (i0 + 1) * nlon;
  const top = data[r0 + j0] * (1 - fx) + data[r0 + j1] * fx;
  const bot = data[r1 + j0] * (1 - fx) + data[r1 + j1] * fx;
  return top * (1 - fy) + bot * fy;
}

/**
 * Build the shared ellipsoid mesh on the data grid plus the per-vertex geoid attributes.
 * Returns typed arrays: position, normal (ellipsoid), aN (N / a), aNormalHi (normal of the
 * surface displaced at kHi), and a Uint32 index buffer with outward (CCW) winding.
 */
export function buildGlobeArrays(grid, kHi = 10000) {
  const { nlat, nlon, lat0, dlat, lon0, dlon, data } = grid;
  const n = nlat * nlon;
  const position = new Float32Array(3 * n);
  const normal = new Float32Array(3 * n);
  const aN = new Float32Array(n);
  const hi = new Float64Array(3 * n); // displaced positions at kHi, for normals
  const p = [0, 0, 0], q = [0, 0, 0];

  for (let i = 0; i < nlat; i++) {
    const lat = lat0 + i * dlat;
    for (let j = 0; j < nlon; j++) {
      const lon = lon0 + j * dlon, v = i * nlon + j;
      geodeticToThree(lat, lon, 0, p);
      geodeticNormalThree(lat, lon, q);
      const nRel = data[v] / WGS84.a;
      for (let k = 0; k < 3; k++) {
        position[3 * v + k] = p[k];
        normal[3 * v + k] = q[k];
        hi[3 * v + k] = p[k] + q[k] * nRel * kHi;
      }
      aN[v] = nRel;
    }
  }

  // Normals of the exaggerated surface by central differences (wrapping in longitude).
  const aNormalHi = new Float32Array(3 * n);
  const ring = nlon - 1;
  for (let i = 0; i < nlat; i++) {
    const iu = Math.max(i - 1, 0), id = Math.min(i + 1, nlat - 1);
    for (let j = 0; j < nlon; j++) {
      const jw = j % ring, jl = (jw - 1 + ring) % ring, jr = (jw + 1) % ring;
      const v = i * nlon + j;
      const L = i * nlon + jl, R = i * nlon + jr, U = iu * nlon + jw, D = id * nlon + jw;
      const ex = [hi[3 * R] - hi[3 * L], hi[3 * R + 1] - hi[3 * L + 1], hi[3 * R + 2] - hi[3 * L + 2]]; // east
      const nx = [hi[3 * U] - hi[3 * D], hi[3 * U + 1] - hi[3 * D + 1], hi[3 * U + 2] - hi[3 * D + 2]]; // north
      let c0 = ex[1] * nx[2] - ex[2] * nx[1];
      let c1 = ex[2] * nx[0] - ex[0] * nx[2];
      let c2 = ex[0] * nx[1] - ex[1] * nx[0];
      const len = Math.hypot(c0, c1, c2);
      const b0 = normal[3 * v], b1 = normal[3 * v + 1], b2 = normal[3 * v + 2];
      if (len < 1e-12) { c0 = b0; c1 = b1; c2 = b2; } // poles: east tangent degenerates
      else {
        c0 /= len; c1 /= len; c2 /= len;
        if (c0 * b0 + c1 * b1 + c2 * b2 < 0) { c0 = -c0; c1 = -c1; c2 = -c2; }
      }
      aNormalHi[3 * v] = c0; aNormalHi[3 * v + 1] = c1; aNormalHi[3 * v + 2] = c2;
    }
  }

  // Rows run north -> south, columns west -> east. Seen from outside: a = NW, b = NE, c = SW, d = SE.
  const index = new Uint32Array((nlat - 1) * (nlon - 1) * 6);
  let t = 0;
  for (let i = 0; i < nlat - 1; i++) {
    for (let j = 0; j < nlon - 1; j++) {
      const a = i * nlon + j, b = a + 1, c = a + nlon, d = c + 1;
      index[t++] = a; index[t++] = c; index[t++] = b;
      index[t++] = b; index[t++] = c; index[t++] = d;
    }
  }
  return { position, normal, aN, aNormalHi, index };
}

/**
 * Turn polylines of [lon, lat] points into line-segment arrays draped on the grid.
 * Long segments are densified to <= maxStepDeg; segments that jump the antimeridian are dropped.
 * Returns { position, aDir, aN } for THREE.LineSegments (two vertices per segment).
 */
export function buildDrapedSegments(polylines, grid, maxStepDeg = 1) {
  const pos = [], dir = [], nn = [];
  const p = [0, 0, 0], q = [0, 0, 0];
  const push = (lon, lat) => {
    geodeticToThree(lat, lon, 0, p); geodeticNormalThree(lat, lon, q);
    pos.push(p[0], p[1], p[2]); dir.push(q[0], q[1], q[2]);
    nn.push(grid ? sampleGrid(grid, lat, lon) / WGS84.a : 0);
  };
  for (const line of polylines) {
    for (let k = 0; k + 1 < line.length; k++) {
      const [lon1, lat1] = line[k], [lon2, lat2] = line[k + 1];
      if (Math.abs(lon2 - lon1) > 180) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon2 - lon1), Math.abs(lat2 - lat1)) / maxStepDeg));
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps, t1 = (s + 1) / steps;
        push(lon1 + (lon2 - lon1) * t0, lat1 + (lat2 - lat1) * t0);
        push(lon1 + (lon2 - lon1) * t1, lat1 + (lat2 - lat1) * t1);
      }
    }
  }
  return { position: new Float32Array(pos), aDir: new Float32Array(dir), aN: new Float32Array(nn) };
}

/** Latitude/longitude lines every `everyDeg`, as polylines of [lon, lat]. */
export function graticulePolylines(everyDeg = 15, sampleDeg = 1) {
  const lines = [];
  for (let lat = -90 + everyDeg; lat < 90; lat += everyDeg) {
    const l = [];
    for (let lon = -180; lon <= 180; lon += sampleDeg) l.push([lon, lat]);
    lines.push(l);
  }
  for (let lon = -180; lon < 180; lon += everyDeg) {
    const l = [];
    for (let lat = -90; lat <= 90; lat += sampleDeg) l.push([lon, lat]);
    lines.push(l);
  }
  return lines;
}

/** Extract [lon, lat] polylines from a GeoJSON FeatureCollection (LineString / MultiLineString / Polygon rings). */
export function geojsonPolylines(fc) {
  const out = [];
  const walk = (g) => {
    if (!g) return;
    if (g.type === 'LineString') out.push(g.coordinates);
    else if (g.type === 'MultiLineString' || g.type === 'Polygon') out.push(...g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => out.push(...poly));
    else if (g.type === 'GeometryCollection') g.geometries.forEach(walk);
  };
  (fc.features || []).forEach((f) => walk(f.geometry));
  return out;
}

// ColorBrewer RdBu (11-class), reversed so negative N = blue, positive N = red. sRGB hex.
export const DIVERGING = ['#053061', '#2166ac', '#4393c3', '#92c5de', '#d1e5f0', '#f7f7f7',
  '#fddbc7', '#f4a582', '#d6604d', '#b2182b', '#67001f'];

const hexToRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
const STOPS = DIVERGING.map(hexToRgb);

/** sRGB [r, g, b] in 0..1 for value v on a symmetric diverging scale clamped at +/- vmax. */
export function divergingColor(v, vmax) {
  const t = Math.min(Math.max((v / vmax + 1) / 2, 0), 1) * (STOPS.length - 1);
  const k = Math.min(Math.floor(t), STOPS.length - 2), f = t - k;
  const a = STOPS[k], b = STOPS[k + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
