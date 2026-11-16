# AltitudeProject

A React + Vite foundation for an educational visualization project about the WGS84 ellipsoid, geoid models, and altitude reference systems.

## Current status
- `/visualization`: a Three.js globe of the GOCO06s geoid over the WGS84 ellipsoid, with adjustable vertical exaggeration.
- `/altitude`: terrain, geoid and ellipsoid heights for points in the U.S. (USGS elevations and a simplified geoid model).

## Running
```bash
npm install
npm run dev
```

## Geoid data
The globe loads a preprocessed global grid from `public/data/` (`geoid.json` + `geoid_f32.bin`, already committed).
To regenerate it:

1. Download a geoid-height grid for GOCO06s (reference system WGS84, 0.25° step) as a `.gdf` file from the
   ICGEM Calculation Service (http://icgem.gfz-potsdam.de/calcgrid). Raw `.gdf` files are gitignored.
2. From the repo root, run `python3 scripts/preprocess_geoid.py GOCO06s_geoid.gdf` (needs numpy).

Coastlines are optional. To show them, add Natural Earth's `ne_110m_coastline.geojson` to `public/data/`.

## Recommended project structure

- `src/geodesy/` — WGS84 and geoid model domain logic (no Three.js dependency)
- `src/rendering/` — Three.js globe scene, mesh builders and colormaps
- `src/services/` — API and data access boundaries, including future USGS or geoid providers
- `src/pages/` — route-level page components
- `src/components/` — reusable UI building blocks
- `src/hooks/` — application state hooks and domain orchestration
- `src/utils/` — shared helpers and constants
- `public/data/` — preprocessed geoid grid served at `/data/`
- `scripts/` — offline data preprocessing (Python)
- `docker/` — reserved for future Docker-related setup

## Initial routes
- `/visualization`
- `/altitude`

## Notes
- The codebase follows a clean separation between geodesy logic, rendering, services, and UI.
- Business logic is intentionally kept out of page components for easier extension.
