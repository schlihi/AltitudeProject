export function useGeoidVisualization() {
  return {
    summary:
      'This page will eventually visualize the relationship between the WGS84 ellipsoid and the geoid using a clear educational narrative.',
    futureAreas: [
      'Build WGS84 ellipsoid parameters',
      'Add geoid separation overlays',
      'Compare ellipsoid and geoid surfaces',
      'Layer in user-friendly explanation panels',
    ],
  };
}

// TODO: WGS84 ellipsoid construction and reference parameters should live here or in the geodesy module.
// TODO: EGM2008 model integration and geoid interpolation will be added in a dedicated geodesy service.
