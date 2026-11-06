import PageHeader from '../components/PageHeader';
import InfoPanel from '../components/InfoPanel';
import { useGeoidVisualization } from '../hooks/useGeoidVisualization';

export default function VisualizationPage() {
  const { summary, futureAreas } = useGeoidVisualization();

  return (
    <main className="page-shell">
      <PageHeader
        title="Geoid Visualization"
        description="Foundation for an educational comparison between the ellipsoid and the geoid."
      />

      <div className="content-grid">
        <InfoPanel title="Current status">
          <span className="tag">Setup Phase</span>
          <p>{summary}</p>
        </InfoPanel>

        <InfoPanel title="Planned view">
          <ul>
            {futureAreas.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </InfoPanel>

        <InfoPanel title="Visualization placeholder">
          <div className="placeholder-box">
            Renderer area for ellipsoid and geoid overlay will live here.
          </div>
        </InfoPanel>
      </div>

      <section className="card" style={{ marginTop: '24px' }}>
        <h3>Future geodesy integration</h3>
        <ul>
          <li>
            WGS84 ellipsoid construction and metadata will live in the geodesy layer, not in this page.
          </li>
          <li>
            EGM2008 geoid model support will be added behind a dedicated geoid service or model adapter.
          </li>
          <li>
            Rendering logic for the ellipsoid surface and geoid separation will be kept separate from the
            geodesy math.
          </li>
        </ul>
      </section>
    </main>
  );
}
