import InfoPanel from './InfoPanel';
import { DIVERGING } from '../rendering/colormap';
import { K_STOPS, VMAX, globePresets } from '../rendering/geoidGlobe';
import { formatExaggeration, formatSigned, formatSignedLength } from '../utils/formatting';

const LEGEND_TICKS = [-100, -50, 0, 50, 100];
const LAYER_TOGGLES = [
  { name: 'coast', label: 'Coastlines' },
  { name: 'graticule', label: 'Ellipsoid grid' },
  { name: 'fill', label: 'Ellipsoid shell' },
  { name: 'labels', label: 'Labels' },
];
const PRESET_KEYS = { global: 'G', low: 'L', high: 'H', mv: 'M' };

export default function GeoidControls({
  grid,
  hasCoastlines,
  k,
  t,
  layers,
  onSliderChange,
  onStop,
  onPreset,
  onLayerToggle,
}) {
  const lo = grid.min.value;
  const hi = grid.max.value;
  const presetLabels = {
    global: 'Global',
    low: `Low (${formatSignedLength(lo)})`,
    high: `High (${formatSignedLength(hi)})`,
    mv: 'Mountain View',
  };
  const synthetic = /synthetic/i.test(grid.model || '');
  const mv = grid.poi?.['Mountain View'];

  return (
    <div className="geoid-controls">
      <InfoPanel title="Vertical exaggeration">
        <p className={`geoid-model${synthetic ? ' geoid-model--warn' : ''}`}>
          Model: {grid.model || 'unknown'}
        </p>
        <div className="k-readout">
          <span className="k-value">{formatExaggeration(k)}</span>
        </div>
        <p className="k-detail">
          Geoid heights {formatSignedLength(lo)} to {formatSignedLength(hi)} drawn as{' '}
          {formatSignedLength(lo * k)} to {formatSignedLength(hi * k)}
        </p>
        <input
          className="k-slider"
          type="range"
          min="0"
          max="1"
          step="0.0005"
          value={t}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          aria-label="Vertical exaggeration (log scale)"
        />
        <div className="chip-row chip-row--spread">
          {K_STOPS.map((stop, i) => (
            <button
              key={stop}
              type="button"
              className={`chip${Math.abs(stop - k) / k < 0.01 ? ' chip--on' : ''}`}
              title={`Key ${i + 1}`}
              onClick={() => onStop(stop)}
            >
              {stop.toLocaleString()}×
            </button>
          ))}
        </div>
      </InfoPanel>

      <InfoPanel title="Camera">
        <div className="chip-row">
          {Object.keys(globePresets(grid)).map((name) => (
            <button key={name} type="button" className="chip" title={`Key ${PRESET_KEYS[name]}`} onClick={() => onPreset(name)}>
              {presetLabels[name]}
            </button>
          ))}
        </div>
        <div className="layer-toggles">
          {LAYER_TOGGLES.map(({ name, label }) => {
            const unavailable = name === 'coast' && !hasCoastlines;
            return (
              <label
                key={name}
                title={unavailable ? 'Add public/data/ne_110m_coastline.geojson to show coastlines' : undefined}
              >
                <input
                  type="checkbox"
                  checked={layers[name] && !unavailable}
                  disabled={unavailable}
                  onChange={(e) => onLayerToggle(name, e.target.checked)}
                />
                {label}
              </label>
            );
          })}
        </div>
      </InfoPanel>

      <InfoPanel title="Geoid height N above the ellipsoid (m)">
        <div className="legend-bar" style={{ background: `linear-gradient(to right, ${DIVERGING.join(', ')})` }} />
        <div className="legend-ticks">
          {LEGEND_TICKS.map((v) => (
            <span key={v} style={{ left: `${((v / VMAX + 1) / 2) * 100}%` }}>
              {v === 0 ? '0' : formatSigned(v)}
            </span>
          ))}
        </div>
        {mv ? (
          <p className="poi-note">
            Mountain View: N = {formatSigned(mv.N, 1)} m, so h<sub>GPS</sub> = H<sub>MSL</sub>{' '}
            {mv.N < 0 ? '−' : '+'} {Math.abs(mv.N).toFixed(1)} m
          </p>
        ) : null}
        <p className="globe-help">
          Keys: 1–5 exaggeration stops · G/L/H/M camera · drag to rotate, scroll to zoom
        </p>
      </InfoPanel>
    </div>
  );
}
