import PageHeader from '../components/PageHeader';
import InfoPanel from '../components/InfoPanel';
import { useAltitudeComparison } from '../hooks/useAltitudeComparison';

export default function AltitudePage() {
  const { equation, referencePoints } = useAltitudeComparison();

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
            {referencePoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </InfoPanel>

        <InfoPanel title="Map placeholder">
          <div className="placeholder-box">
            U.S. map and altitude relationship view will be rendered here.
          </div>
        </InfoPanel>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <h3>Future altitude and drone logic</h3>
        <ul>
          <li>
            Terrain elevation, geoid undulation, and ellipsoid height will be modeled in the geodesy layer.
          </li>
          <li>
            Drone-specific altitude interpretation will live in a separate service or domain module so the UI
            remains presentation focused.
          </li>
          <li>
            USGS Elevation API access and GEOID18 integration will be isolated from the page component.
          </li>
        </ul>
      </section>
    </main>
  );
}
