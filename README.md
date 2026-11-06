# AltitudeProject

A React + Vite foundation for an educational visualization project about the WGS84 ellipsoid, geoid models, and altitude reference systems.

## Current status
This version focuses on architecture and project structure only. No geospatial calculations, API integrations, or rendering logic are implemented yet.

## Recommended project structure

- `src/geodesy/` — WGS84 and geoid model domain logic
- `src/rendering/` — 2D/3D rendering and scene setup for future Three.js integration
- `src/services/` — API and data access boundaries, including future USGS or geoid providers
- `src/pages/` — route-level page components
- `src/components/` — reusable UI building blocks
- `src/hooks/` — application state hooks and domain orchestration
- `src/utils/` — shared helpers and constants
- `docker/` — reserved for future Docker-related setup

## Initial routes
- `/visualization`
- `/altitude`

## Notes
- The codebase follows a clean separation between geodesy logic, rendering, services, and UI.
- Business logic is intentionally kept out of page components for easier extension.
- This is a preparation layer for future Three.js and Docker work.
