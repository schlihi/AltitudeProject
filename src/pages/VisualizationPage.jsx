import PageHeader from '../components/PageHeader';
import InfoPanel from '../components/InfoPanel';
import GeoidControls from '../components/GeoidControls';
import SceneCanvas from '../rendering/SceneCanvas';
import { useGeoidVisualization } from '../hooks/useGeoidVisualization';

export default function VisualizationPage() {
  const viz = useGeoidVisualization();

  return (
    <main className="page-shell page-shell--wide">
      <PageHeader
        title="Geoid Visualization"
        description="The geoid drawn over the WGS84 ellipsoid, with adjustable vertical exaggeration."
      />

      <div className="globe-layout">
        <section className="card globe-card">
          {viz.grid ? (
            <SceneCanvas
              grid={viz.grid}
              coastlines={viz.coastlines}
              onReady={viz.onGlobeReady}
              onKChange={viz.onKChange}
            />
          ) : null}
          {viz.status !== 'ready' ? (
            <div className={`globe-status${viz.status === 'error' ? ' globe-status--error' : ''}`}>
              {viz.status === 'error' ? viz.error : 'Loading geoid grid…'}
            </div>
          ) : null}
        </section>

        {viz.grid ? (
          <GeoidControls
            grid={viz.grid}
            hasCoastlines={Boolean(viz.coastlines)}
            k={viz.k}
            t={viz.t}
            layers={viz.layers}
            onSliderChange={viz.setSliderT}
            onStop={viz.animateToK}
            onPreset={viz.flyTo}
            onLayerToggle={viz.setLayerVisible}
          />
        ) : null}
      </div>

      <InfoPanel title="What you are seeing">
        <ul>
          <li>
            The coloured surface is the geoid, the equipotential surface that mean sea level follows. Its height N
            above the WGS84 ellipsoid ranges from about −106 m to +85 m.
          </li>
          <li>
            At 1× those differences are invisible at globe scale, so raise the exaggeration to see the bumps. Past
            about 100× the translucent ellipsoid shell fades in for comparison.
          </li>
          <li>
            GPS reports height above the ellipsoid (h). Maps report height above the geoid (H). They are related by
            h = H + N. The Altitude Comparison page applies this to points in the U.S.
          </li>
        </ul>
      </InfoPanel>
    </main>
  );
}
