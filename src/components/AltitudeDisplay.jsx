// Safely format a number value
const formatValue = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? 'N/A' : `${num.toFixed(1)} m`;
};

export default function AltitudeDisplay({ data, isLoading, error }) {
  if (error) {
    return (
      <div className="altitude-display altitude-display--error">
        <h3>Error</h3>
        <p>{error}</p>
      </div>
    );
  }

  if (!data && !isLoading) {
    return (
      <div className="altitude-display altitude-display--empty">
        <h3>Altitude Comparison</h3>
        <p>Select a location on the map to view altitude data.</p>
        <div className="altitude-diagram-placeholder">
          <div className="diagram-layer diagram-layer--ellipsoid">
            <span>Ellipsoid (WGS84)</span>
          </div>
          <div className="diagram-layer diagram-layer--geoid">
            <span>Geoid (MSL)</span>
          </div>
          <div className="diagram-layer diagram-layer--terrain">
            <span>Terrain</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="altitude-display altitude-display--loading">
        <h3>Loading altitude data...</h3>
        <div className="loading-spinner" />
      </div>
    );
  }

  const { lat, lon, terrainElevation, geoidUndulation, ellipsoidHeight } = data;

  // Calculate relative positions for the diagram
  const maxAlt = Math.max(terrainElevation, 0) + 50;
  const minAlt = Math.min(geoidUndulation, ellipsoidHeight, 0) - 50;
  const range = maxAlt - minAlt;

  const getYPosition = (value) => {
    return 100 - ((value - minAlt) / range) * 100;
  };

  return (
    <div className="altitude-display">
      <h3>Altitude at Selected Location</h3>
      
      <div className="location-info">
        <span className="tag">
          {lat.toFixed(4)}°N, {Math.abs(lon).toFixed(4)}°W
        </span>
      </div>

      <div className="altitude-values">
        <div className="altitude-item altitude-item--terrain">
          <div className="altitude-label">
            <span className="altitude-icon">🏔️</span>
            Terrain Elevation (H)
          </div>
          <div className="altitude-value">
            {formatValue(terrainElevation)}
          </div>
          <div className="altitude-desc">Height above Mean Sea Level (geoid)</div>
        </div>

        <div className="altitude-item altitude-item--geoid">
          <div className="altitude-label">
            <span className="altitude-icon">🌊</span>
            Geoid Undulation (N)
          </div>
          <div className="altitude-value">{formatValue(geoidUndulation)}</div>
          <div className="altitude-desc">Geoid height relative to ellipsoid</div>
        </div>

        <div className="altitude-item altitude-item--ellipsoid">
          <div className="altitude-label">
            <span className="altitude-icon">🛰️</span>
            Ellipsoid Height (h)
          </div>
          <div className="altitude-value">
            {formatValue(ellipsoidHeight)}
          </div>
          <div className="altitude-desc">Height above WGS84 ellipsoid (GPS altitude)</div>
        </div>
      </div>

      <div className="altitude-equation">
        <div className="equation-box">
          <span className="eq-h">h</span> = <span className="eq-H">H</span> + <span className="eq-N">N</span>
        </div>
        {terrainElevation !== null && typeof terrainElevation === 'number' && (
          <div className="equation-values">
            {ellipsoidHeight?.toFixed(1) ?? 'N/A'} = {terrainElevation.toFixed(1)} + ({geoidUndulation?.toFixed(1) ?? 'N/A'})
          </div>
        )}
      </div>

      {/* Visual diagram */}
      <div className="altitude-diagram">
        <div className="diagram-title">Cross-Section View</div>
        <svg viewBox="0 0 300 180" className="diagram-svg">
          {/* Reference line at 0 */}
          <line
            x1="40"
            y1={30 + getYPosition(0) * 1.2}
            x2="280"
            y2={30 + getYPosition(0) * 1.2}
            stroke="rgba(255,255,255,0.2)"
            strokeDasharray="4,4"
          />
          <text
            x="35"
            y={34 + getYPosition(0) * 1.2}
            fill="rgba(255,255,255,0.4)"
            fontSize="8"
            textAnchor="end"
          >
            0m
          </text>

          {/* Ellipsoid reference (at 0) */}
          <line
            x1="60"
            y1={30 + getYPosition(0) * 1.2}
            x2="260"
            y2={30 + getYPosition(0) * 1.2}
            stroke="#60a5fa"
            strokeWidth="2"
          />
          
          {/* Geoid surface (wavy line at N) */}
          <path
            d={`M 60,${30 + getYPosition(geoidUndulation) * 1.2} 
                Q 100,${30 + getYPosition(geoidUndulation - 3) * 1.2} 
                  140,${30 + getYPosition(geoidUndulation) * 1.2}
                Q 180,${30 + getYPosition(geoidUndulation + 2) * 1.2}
                  220,${30 + getYPosition(geoidUndulation) * 1.2}
                Q 240,${30 + getYPosition(geoidUndulation - 1) * 1.2}
                  260,${30 + getYPosition(geoidUndulation) * 1.2}`}
            stroke="#22c55e"
            strokeWidth="2"
            fill="none"
          />

          {/* Terrain point */}
          {terrainElevation !== null && (
            <>
              {/* Terrain surface indicator */}
              <path
                d={`M 130,${30 + getYPosition(0) * 1.2} 
                    L 150,${30 + getYPosition(terrainElevation * 0.3) * 1.2}
                    L 160,${30 + getYPosition(terrainElevation) * 1.2}
                    L 170,${30 + getYPosition(terrainElevation * 0.5) * 1.2}
                    L 190,${30 + getYPosition(0) * 1.2}`}
                stroke="#f59e0b"
                strokeWidth="2"
                fill="rgba(245, 158, 11, 0.2)"
              />
              
              {/* Height markers */}
              {/* H - Terrain height above geoid */}
              <line
                x1="200"
                y1={30 + getYPosition(geoidUndulation) * 1.2}
                x2="200"
                y2={30 + getYPosition(terrainElevation + geoidUndulation) * 1.2}
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <text x="205" y={30 + getYPosition((terrainElevation + geoidUndulation) / 2 + geoidUndulation / 2) * 1.2} fill="#f59e0b" fontSize="10" fontWeight="bold">H</text>

              {/* N - Geoid undulation */}
              <line
                x1="220"
                y1={30 + getYPosition(0) * 1.2}
                x2="220"
                y2={30 + getYPosition(geoidUndulation) * 1.2}
                stroke="#22c55e"
                strokeWidth="1.5"
              />
              <text x="225" y={30 + getYPosition(geoidUndulation / 2) * 1.2} fill="#22c55e" fontSize="10" fontWeight="bold">N</text>

              {/* h - Ellipsoid height */}
              <line
                x1="240"
                y1={30 + getYPosition(0) * 1.2}
                x2="240"
                y2={30 + getYPosition(ellipsoidHeight) * 1.2}
                stroke="#60a5fa"
                strokeWidth="1.5"
              />
              <text x="245" y={30 + getYPosition(ellipsoidHeight / 2) * 1.2} fill="#60a5fa" fontSize="10" fontWeight="bold">h</text>
            </>
          )}

          {/* Legend */}
          <g transform="translate(60, 150)">
            <line x1="0" y1="0" x2="15" y2="0" stroke="#60a5fa" strokeWidth="2" />
            <text x="20" y="4" fill="#e5eefb" fontSize="8">Ellipsoid (WGS84)</text>
            
            <line x1="80" y1="0" x2="95" y2="0" stroke="#22c55e" strokeWidth="2" />
            <text x="100" y="4" fill="#e5eefb" fontSize="8">Geoid (MSL)</text>
            
            <line x1="155" y1="0" x2="170" y2="0" stroke="#f59e0b" strokeWidth="2" />
            <text x="175" y="4" fill="#e5eefb" fontSize="8">Terrain</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
