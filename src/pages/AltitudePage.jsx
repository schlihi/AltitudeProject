import PageHeader from '../components/PageHeader';
import InfoPanel from '../components/InfoPanel';
import USMap from '../components/USMap';
import AltitudeDisplay from '../components/AltitudeDisplay';
import { useAltitudeComparison } from '../hooks/useAltitudeComparison';

export default function AltitudePage() {
  const {
    equation,
    referencePoints,
    selectedLocation,
    altitudeData,
    isLoading,
    error,
    selectLocation,
  } = useAltitudeComparison();

  return (
    <main className="page-shell">
      <PageHeader
        title="Altitude Comparison"
        description="Educational comparison of terrain height, geoid separation, ellipsoid height, and drone altitude."
      />

      <div className="content-grid">
        <InfoPanel title="Core equation">
          <span className="tag">h = H + N</span>
          <p>{equation}</p>
        </InfoPanel>

        <InfoPanel title="Reference values">
          <ul>
            {referencePoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </InfoPanel>
      </div>

      <div className="map-section">
        <div className="map-panel">
          <h2>Select Location on U.S. Map</h2>
          <USMap
            onLocationSelect={selectLocation}
            selectedLocation={selectedLocation}
            isLoading={isLoading}
          />
        </div>

        <div className="altitude-panel">
          <AltitudeDisplay
            data={altitudeData}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <h3>Understanding Altitude References</h3>
        <ul>
          <li>
            <strong>GPS devices</strong> report ellipsoid height (h), not terrain elevation.
          </li>
          <li>
            <strong>Topographic maps</strong> show orthometric height (H) — elevation above Mean Sea Level.
          </li>
          <li>
            The <strong>geoid</strong> is an equipotential surface approximating global Mean Sea Level; it varies due to Earth&apos;s uneven mass distribution.
          </li>
          <li>
            In the continental U.S., geoid undulation (N) ranges from about −52m to +5m.
          </li>
        </ul>
      </section>
    </main>
  );
}
