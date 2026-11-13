#!/usr/bin/env python3
"""
Convert a global geoid-height grid into the binary + JSON pair the viewer loads.

Inputs (auto-detected by extension):
  .gdf  ICGEM Calculation Service grid output (e.g. GOCO06s geoid heights, reference system WGS84). The geoid value is taken from the last column.

Output (in --out, default ./data):
  geoid_f32.bin  little-endian float32, geoid height N in metres, rows: latitude 90 -> -90, cols: longitude -180 -> 180 (the 180 column duplicates -180 so the mesh seam closes).
  geoid.json     grid description, model name, min/max with locations, and N at points of interest.

To run:
  python3 preprocess_geoid.py GOCO06s_geoid.gdf
  python3 -m http.server 8000
"""
import argparse
import json
import sys
from pathlib import Path
import numpy as np

POINTS_OF_INTEREST = {
    "Mountain View": (37.3861, -122.0839),
}


# --------------------------------------------------------------------------
# Readers: each returns (lats_ascending[nlat], lons_ascending[nlon], grid[nlat, nlon], meta)
# with lons covering exactly 360 degrees without a duplicated seam column.
# --------------------------------------------------------------------------

def read_icgem_gdf(path):
    header, rows, in_head = {}, [], True
    with open(path, "r", errors="replace") as fh:
        for line in fh:
            s = line.strip()
            if in_head:
                if s.lower().startswith("end_of_head"):
                    in_head = False
                    continue
                parts = s.split(None, 1)
                if len(parts) == 2:
                    header[parts[0].lower()] = parts[1].strip()
                continue
            if not s:
                continue
            vals = s.split()
            try:
                rows.append((float(vals[0]), float(vals[1]), float(vals[-1])))
            except (ValueError, IndexError):
                continue
    if in_head:
        sys.exit(f"{path}: no 'end_of_head' line found")
    if not rows:
        sys.exit(f"{path}: no data rows found.")
    arr = np.asarray(rows, dtype=np.float64)
    lon, lat, val = arr[:, 0], arr[:, 1], arr[:, 2]
    lon = np.where(lon >= 180.0 - 1e-9, lon - 360.0, lon)  # normalise to [-180, 180)

    ulat = np.unique(np.round(lat, 8))
    ulon = np.unique(np.round(lon, 8))
    dlat = _regular_step(ulat, "latitude")
    dlon = _regular_step(ulon, "longitude")
    i = np.rint((lat - ulat[0]) / dlat).astype(int)
    j = np.rint((lon - ulon[0]) / dlon).astype(int)
    grid = np.full((len(ulat), len(ulon)), np.nan)
    grid[i, j] = val
    if np.isnan(grid).any():
        sys.exit(f"{path}: grid has holes ({np.isnan(grid).sum()} missing nodes).")
    meta = {k: header[k] for k in ("modelname", "functional", "refsysname", "tide_system") if k in header}
    return ulat, ulon, grid, meta


def _regular_step(u, name):
    d = np.diff(u)
    if len(d) == 0 or not np.allclose(d, d[0], rtol=1e-4, atol=1e-6):
        sys.exit(f"Input {name}s are not a regular grid.")
    return float(d[0])


# --------------------------------------------------------------------------
# Resampling onto the viewer's grid
# --------------------------------------------------------------------------

def to_global_ring(lats, lons, grid):
    """Drop a duplicated seam column and check the input is global."""
    dlon = lons[1] - lons[0]
    if abs((lons[-1] - lons[0]) - 360.0) < 1e-6:
        lons, grid = lons[:-1], grid[:, :-1]
    if abs(len(lons) * dlon - 360.0) > 1e-4:
        sys.exit("Input does not cover all longitudes; request a global grid (-180..180).")
    if lats[0] > -90 + 1e-6 or lats[-1] < 90 - 1e-6:
        print(f"warning: latitude coverage {lats[0]}..{lats[-1]}; values beyond are clamped.")
    return lats, lons, grid


def bilinear(lats, lons, grid, qlat, qlon):
    """Bilinear interpolation on a global grid (lats ascending, lons ascending, wraps in lon)."""
    dlat, dlon = lats[1] - lats[0], lons[1] - lons[0]
    nlat, nlon = grid.shape
    y = np.clip((np.asarray(qlat) - lats[0]) / dlat, 0, nlat - 1)
    x = np.mod(np.asarray(qlon) - lons[0], 360.0) / dlon
    i0 = np.minimum(np.floor(y).astype(int), nlat - 2)
    j0 = np.floor(x).astype(int) % nlon
    fy, fx = y - i0, x - np.floor(x)
    j1 = (j0 + 1) % nlon
    g00, g01 = grid[i0, j0], grid[i0, j1]
    g10, g11 = grid[i0 + 1, j0], grid[i0 + 1, j1]
    return (g00 * (1 - fx) + g01 * fx) * (1 - fy) + (g10 * (1 - fx) + g11 * fx) * fy


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", nargs="?", help=".gdf (ICGEM) geoid grid")
    ap.add_argument("-o", "--out", default="data", help="output directory (default: data)")
    ap.add_argument("--step", type=float, default=0.25, help="output grid step in degrees (default 0.25)")
    ap.add_argument("--model", default="GOCO06s", help="model name shown in the viewer, e.g. GOCO06s")
    args = ap.parse_args()

    step = args.step
    if abs(180.0 / step - round(180.0 / step)) > 1e-9:
        sys.exit("--step must divide 180 evenly (e.g. 0.25, 0.5, 1).")
    nlat, nlon = int(round(180 / step)) + 1, int(round(360 / step)) + 1
    out_lat = np.linspace(90.0, -90.0, nlat)
    out_lon = np.linspace(-180.0, 180.0, nlon)
    QLON, QLAT = np.meshgrid(out_lon, out_lat)

    if not args.input:
        ap.error("give an input file")
    path = Path(args.input)
    ext = path.suffix.lower()
    if ext == ".gdf":
        lats, lons, grid, meta = read_icgem_gdf(path)
    else:
        sys.exit("Unknown input type; expected .gdf")
    lats, lons, grid = to_global_ring(lats, lons, grid)
    in_step = lons[1] - lons[0]
    if in_step > step + 1e-9:
        print(f"note: input step {in_step:g} deg is coarser than output {step:g} deg; interpolating.")
    N = bilinear(lats, lons, grid, QLAT, QLON)
    model = args.model or meta.get("modelname") or path.stem
    source = path.name

    N = N.astype(np.float32)
    N[:, -1] = N[:, 0]  # exact seam

    imin, imax = np.unravel_index(np.argmin(N), N.shape), np.unravel_index(np.argmax(N), N.shape)
    lat_asc, Nasc = out_lat[::-1], N[::-1, :-1].astype(np.float64)
    poi = {}
    for name, (plat, plon) in POINTS_OF_INTEREST.items():
        val = float(bilinear(lat_asc, out_lon[:-1], Nasc, plat, plon))
        poi[name] = {"lat": plat, "lon": plon, "N": round(val, 2)}

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    N.astype("<f4").tofile(out / "geoid_f32.bin")
    info = {
        "format": "float32-le, row-major, rows lat0 + i*dlat, cols lon0 + j*dlon",
        "nlat": nlat, "nlon": nlon,
        "lat0": 90.0, "dlat": -step, "lon0": -180.0, "dlon": step,
        "units": "m", "quantity": "geoid height N above the WGS 84 ellipsoid",
        "model": model, "source_file": source, "source_header": meta,
        "min": {"value": round(float(N[imin]), 2), "lat": float(out_lat[imin[0]]), "lon": float(out_lon[imin[1]])},
        "max": {"value": round(float(N[imax]), 2), "lat": float(out_lat[imax[0]]), "lon": float(out_lon[imax[1]])},
        "poi": poi,
    }
    (out / "geoid.json").write_text(json.dumps(info, indent=2))

    print(f"model: {model}")
    print(f"grid:  {nlat} x {nlon} at {step:g} deg  ->  {out / 'geoid_f32.bin'} ({N.nbytes / 1e6:.1f} MB)")
    print(f"min:   {info['min']['value']:8.2f} m at lat {info['min']['lat']:7.2f}, lon {info['min']['lon']:8.2f}")
    print(f"max:   {info['max']['value']:8.2f} m at lat {info['max']['lat']:7.2f}, lon {info['max']['lon']:8.2f}")
    for name, p in poi.items():
        print(f"{name}: N = {p['N']:.2f} m")
    print("sanity check: GOCO06s/EGM2008 should give roughly -106 m (south of India) and +85 m (near Iceland).")


if __name__ == "__main__":
    main()
