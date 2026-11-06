export function useAltitudeComparison() {
  return {
    equation:
      'This page will explain the standard relationship between ellipsoidal height, terrain height, and geoid separation.',
    referencePoints: [
      'Terrain elevation (H)',
      'Geoid / Mean Sea Level (N)',
      'Ellipsoid height (h)',
      'Drone altitude reference',
    ],
  };
}

// TODO: h = H + N relationship logic and reference-system handling belong in a geodesy domain module.
// TODO: USGS Elevation API data loading and GEOID18 mapping should be isolated in services/.
// TODO: Drone-related altitude interpretation logic belongs in a dedicated application or domain hook.
