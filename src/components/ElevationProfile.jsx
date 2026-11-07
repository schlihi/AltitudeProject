import { useMemo } from 'react';

export default function ElevationProfile({ profileData, startPoint, endPoint, isLoading }) {
  // Filter out null elevations and calculate stats
  const { validData, stats } = useMemo(() => {
    if (!profileData || profileData.length === 0) {
      return { validData: [], stats: null };
    }

    const valid = profileData.filter(p => p.elevation !== null);
    if (valid.length === 0) {
      return { validData: [], stats: null };
    }

    const elevations = valid.map(p => p.elevation);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);
    const totalDistance = profileData[profileData.length - 1]?.distance || 0;
    const elevationGain = valid.reduce((gain, point, i) => {
      if (i === 0) return 0;
      const prevValid = valid[i - 1];
      const diff = point.elevation - prevValid.elevation;
      return gain + (diff > 0 ? diff : 0);
    }, 0);

    return {
      validData: valid,
      stats: {
        minElevation,
        maxElevation,
        totalDistance,
        elevationGain,
        startElevation: valid[0]?.elevation,
        endElevation: valid[valid.length - 1]?.elevation,
      }
    };
  }, [profileData]);

  if (isLoading) {
    return (
      <div className="elevation-profile elevation-profile--loading">
        <h3>Loading Elevation Profile...</h3>
        <div className="loading-spinner" />
        <p>Fetching elevation data from USGS...</p>
      </div>
    );
  }

  if (!startPoint || !endPoint) {
    return (
      <div className="elevation-profile elevation-profile--empty">
        <h3>Terrain Elevation Profile</h3>
        <p>Select two points on the map to generate an elevation cross-section.</p>
        <div className="profile-instructions">
          <div className="instruction-step">
            <span className="step-number">1</span>
            <span>Click on the map to set the <strong>start point</strong> (green marker)</span>
          </div>
          <div className="instruction-step">
            <span className="step-number">2</span>
            <span>Click again to set the <strong>end point</strong> (red marker)</span>
          </div>
          <div className="instruction-step">
            <span className="step-number">3</span>
            <span>View the terrain profile between your selected points</span>
          </div>
        </div>
      </div>
    );
  }

  if (!stats || validData.length < 2) {
    return (
      <div className="elevation-profile elevation-profile--error">
        <h3>No Elevation Data</h3>
        <p>Could not retrieve elevation data for this path. This may happen if:</p>
        <ul>
          <li>The path crosses over water or outside US coverage</li>
          <li>The USGS service is temporarily unavailable</li>
        </ul>
        <p>Try selecting points within the continental US land area.</p>
      </div>
    );
  }

  // SVG dimensions
  const svgWidth = 600;
  const svgHeight = 250;
  const padding = { top: 30, right: 20, bottom: 50, left: 60 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Scales
  const xScale = (distance) => 
    padding.left + (distance / stats.totalDistance) * chartWidth;
  
  const elevationPadding = (stats.maxElevation - stats.minElevation) * 0.1 || 50;
  const yMin = stats.minElevation - elevationPadding;
  const yMax = stats.maxElevation + elevationPadding;
  const yScale = (elevation) => 
    padding.top + chartHeight - ((elevation - yMin) / (yMax - yMin)) * chartHeight;

  // Generate path for the elevation profile
  const pathPoints = validData.map(p => `${xScale(p.distance)},${yScale(p.elevation)}`);
  const linePath = `M ${pathPoints.join(' L ')}`;
  
  // Area fill path (closed polygon)
  const areaPath = `M ${xScale(0)},${yScale(yMin)} L ${pathPoints.join(' L ')} L ${xScale(stats.totalDistance)},${yScale(yMin)} Z`;

  // Generate Y-axis ticks
  const numYTicks = 5;
  const yTickStep = (yMax - yMin) / (numYTicks - 1);
  const yTicks = Array.from({ length: numYTicks }, (_, i) => yMin + i * yTickStep);

  // Generate X-axis ticks
  const numXTicks = 6;
  const xTickStep = stats.totalDistance / (numXTicks - 1);
  const xTicks = Array.from({ length: numXTicks }, (_, i) => i * xTickStep);

  return (
    <div className="elevation-profile">
      <h3>Terrain Elevation Profile</h3>
      
      {/* Stats summary */}
      <div className="profile-stats">
        <div className="stat-item">
          <span className="stat-label">Distance</span>
          <span className="stat-value">{(stats.totalDistance / 1000).toFixed(1)} km</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Min Elevation</span>
          <span className="stat-value">{stats.minElevation.toFixed(0)} m</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Max Elevation</span>
          <span className="stat-value">{stats.maxElevation.toFixed(0)} m</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Elevation Gain</span>
          <span className="stat-value">{stats.elevationGain.toFixed(0)} m</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="profile-chart-container">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="profile-chart">
          {/* Grid lines */}
          {yTicks.map((tick, i) => (
            <line
              key={`y-grid-${i}`}
              x1={padding.left}
              y1={yScale(tick)}
              x2={svgWidth - padding.right}
              y2={yScale(tick)}
              stroke="rgba(148, 163, 184, 0.15)"
              strokeDasharray="4,4"
            />
          ))}

          {/* Area fill under the profile */}
          <path
            d={areaPath}
            fill="url(#elevationGradient)"
            opacity="0.6"
          />

          {/* Gradient definition */}
          <defs>
            <linearGradient id="elevationGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Elevation line */}
          <path
            d={linePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Start point marker */}
          <circle
            cx={xScale(0)}
            cy={yScale(stats.startElevation)}
            r="6"
            fill="#22c55e"
            stroke="#fff"
            strokeWidth="2"
          />

          {/* End point marker */}
          <circle
            cx={xScale(stats.totalDistance)}
            cy={yScale(stats.endElevation)}
            r="6"
            fill="#ef4444"
            stroke="#fff"
            strokeWidth="2"
          />

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={svgHeight - padding.bottom}
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1"
          />

          {/* Y-axis ticks and labels */}
          {yTicks.map((tick, i) => (
            <g key={`y-tick-${i}`}>
              <line
                x1={padding.left - 5}
                y1={yScale(tick)}
                x2={padding.left}
                y2={yScale(tick)}
                stroke="rgba(148, 163, 184, 0.5)"
              />
              <text
                x={padding.left - 10}
                y={yScale(tick) + 4}
                textAnchor="end"
                fill="#94a3b8"
                fontSize="10"
              >
                {tick.toFixed(0)}m
              </text>
            </g>
          ))}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={svgHeight - padding.bottom}
            x2={svgWidth - padding.right}
            y2={svgHeight - padding.bottom}
            stroke="rgba(148, 163, 184, 0.5)"
            strokeWidth="1"
          />

          {/* X-axis ticks and labels */}
          {xTicks.map((tick, i) => (
            <g key={`x-tick-${i}`}>
              <line
                x1={xScale(tick)}
                y1={svgHeight - padding.bottom}
                x2={xScale(tick)}
                y2={svgHeight - padding.bottom + 5}
                stroke="rgba(148, 163, 184, 0.5)"
              />
              <text
                x={xScale(tick)}
                y={svgHeight - padding.bottom + 20}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
              >
                {(tick / 1000).toFixed(1)}km
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text
            x={padding.left - 45}
            y={svgHeight / 2}
            textAnchor="middle"
            fill="#e5eefb"
            fontSize="11"
            transform={`rotate(-90, ${padding.left - 45}, ${svgHeight / 2})`}
          >
            Elevation (m)
          </text>
          <text
            x={svgWidth / 2}
            y={svgHeight - 10}
            textAnchor="middle"
            fill="#e5eefb"
            fontSize="11"
          >
            Distance
          </text>
        </svg>
      </div>

      {/* Point coordinates */}
      <div className="profile-coordinates">
        <div className="coord-item coord-item--start">
          <span className="coord-marker">●</span>
          <span>Start: {startPoint.lat.toFixed(4)}°, {startPoint.lon.toFixed(4)}° ({stats.startElevation?.toFixed(0)}m)</span>
        </div>
        <div className="coord-item coord-item--end">
          <span className="coord-marker">●</span>
          <span>End: {endPoint.lat.toFixed(4)}°, {endPoint.lon.toFixed(4)}° ({stats.endElevation?.toFixed(0)}m)</span>
        </div>
      </div>
    </div>
  );
}