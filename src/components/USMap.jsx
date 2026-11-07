import { useState, useRef, useEffect } from 'react';

// US bounds (continental)
const US_BOUNDS = {
  minLat: 24.5,
  maxLat: 49.5,
  minLon: -125,
  maxLon: -66.5,
};

// Major cities for reference points
const REFERENCE_CITIES = [
  { name: 'Seattle', lat: 47.6062, lon: -122.3321 },
  { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  { name: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { name: 'Denver', lat: 39.7392, lon: -104.9903 },
  { name: 'Dallas', lat: 32.7767, lon: -96.7970 },
  { name: 'Chicago', lat: 41.8781, lon: -87.6298 },
  { name: 'Miami', lat: 25.7617, lon: -80.1918 },
  { name: 'New York', lat: 40.7128, lon: -74.0060 },
  { name: 'Boston', lat: 42.3601, lon: -71.0589 },
];

// Simplified US outline path (continental states)
const US_PATH = `
  M 80,45 
  L 85,42 L 90,40 L 95,38 L 100,37 L 105,36 L 110,35 
  L 115,34 L 120,33 L 125,33 L 130,34 L 135,36 
  L 140,38 L 145,40 L 150,42 L 155,45 L 158,48 
  L 160,52 L 162,56 L 163,60 L 164,65 L 164,70 
  L 163,75 L 160,80 L 158,82 L 156,84 
  L 152,86 L 148,88 L 144,90 L 140,91 L 135,92 
  L 130,93 L 125,94 L 120,95 L 115,95 L 110,95 
  L 105,95 L 100,95 L 95,96 L 90,97 L 85,98 
  L 80,99 L 75,100 L 70,100 L 65,99 L 60,98 
  L 55,96 L 50,93 L 48,90 L 46,85 L 45,80 
  L 44,75 L 43,70 L 43,65 L 44,60 L 46,55 
  L 50,50 L 55,47 L 60,45 L 65,44 L 70,44 L 75,44 
  Z
`;

export default function USMap({ onLocationSelect, selectedLocation, isLoading }) {
  const svgRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 320 });

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.parentElement.getBoundingClientRect();
        setDimensions({
          width: Math.max(300, rect.width - 40),
          height: Math.max(200, (rect.width - 40) * 0.65),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Convert lat/lon to SVG coordinates
  const latLonToSvg = (lat, lon) => {
    const x = ((lon - US_BOUNDS.minLon) / (US_BOUNDS.maxLon - US_BOUNDS.minLon)) * dimensions.width;
    const y = ((US_BOUNDS.maxLat - lat) / (US_BOUNDS.maxLat - US_BOUNDS.minLat)) * dimensions.height;
    return { x, y };
  };

  // Convert SVG coordinates to lat/lon
  const svgToLatLon = (x, y) => {
    const lon = US_BOUNDS.minLon + (x / dimensions.width) * (US_BOUNDS.maxLon - US_BOUNDS.minLon);
    const lat = US_BOUNDS.maxLat - (y / dimensions.height) * (US_BOUNDS.maxLat - US_BOUNDS.minLat);
    return { lat, lon };
  };

  const handleMapClick = (e) => {
    if (isLoading) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { lat, lon } = svgToLatLon(x, y);

    // Only select if within US bounds
    if (lat >= US_BOUNDS.minLat && lat <= US_BOUNDS.maxLat &&
        lon >= US_BOUNDS.minLon && lon <= US_BOUNDS.maxLon) {
      onLocationSelect(lat, lon);
    }
  };

  const handleCityClick = (e, city) => {
    e.stopPropagation();
    if (isLoading) return;
    onLocationSelect(city.lat, city.lon);
  };

  // Scale factor for the US path (designed for ~200x130 viewBox)
  const pathScale = Math.min(dimensions.width / 210, dimensions.height / 135);
  const pathOffsetX = (dimensions.width - 210 * pathScale) / 2;
  const pathOffsetY = (dimensions.height - 135 * pathScale) / 2;

  return (
    <div className="us-map-container">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        onClick={handleMapClick}
        style={{ cursor: isLoading ? 'wait' : 'crosshair' }}
        className="us-map-svg"
      >
        {/* Background */}
        <rect
          x="0"
          y="0"
          width={dimensions.width}
          height={dimensions.height}
          fill="rgba(15, 30, 50, 0.6)"
          rx="8"
        />

        {/* US outline */}
        <g transform={`translate(${pathOffsetX}, ${pathOffsetY}) scale(${pathScale})`}>
          <path
            d={US_PATH}
            fill="rgba(30, 58, 95, 0.7)"
            stroke="rgba(96, 165, 250, 0.5)"
            strokeWidth={1.5 / pathScale}
          />
        </g>

        {/* Grid lines */}
        {[-120, -110, -100, -90, -80, -70].map((lon) => {
          const { x } = latLonToSvg(40, lon);
          return (
            <line
              key={`lon-${lon}`}
              x1={x}
              y1={0}
              x2={x}
              y2={dimensions.height}
              stroke="rgba(100, 150, 200, 0.15)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}
        {[30, 35, 40, 45].map((lat) => {
          const { y } = latLonToSvg(lat, -100);
          return (
            <line
              key={`lat-${lat}`}
              x1={0}
              y1={y}
              x2={dimensions.width}
              y2={y}
              stroke="rgba(100, 150, 200, 0.15)"
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Reference cities */}
        {REFERENCE_CITIES.map((city) => {
          const { x, y } = latLonToSvg(city.lat, city.lon);
          const isHovered = hoveredCity === city.name;
          return (
            <g key={city.name}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill={isHovered ? '#60a5fa' : 'rgba(96, 165, 250, 0.7)'}
                stroke="#fff"
                strokeWidth="1"
                style={{ cursor: isLoading ? 'wait' : 'pointer', transition: 'r 0.15s' }}
                onClick={(e) => handleCityClick(e, city)}
                onMouseEnter={() => setHoveredCity(city.name)}
                onMouseLeave={() => setHoveredCity(null)}
              />
              {isHovered && (
                <text
                  x={x}
                  y={y - 10}
                  textAnchor="middle"
                  fill="#e5eefb"
                  fontSize="11"
                  fontWeight="500"
                >
                  {city.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Selected location marker */}
        {selectedLocation && (
          <g>
            <circle
              cx={latLonToSvg(selectedLocation.lat, selectedLocation.lon).x}
              cy={latLonToSvg(selectedLocation.lat, selectedLocation.lon).y}
              r="8"
              fill="rgba(239, 68, 68, 0.3)"
              stroke="#ef4444"
              strokeWidth="2"
            />
            <circle
              cx={latLonToSvg(selectedLocation.lat, selectedLocation.lon).x}
              cy={latLonToSvg(selectedLocation.lat, selectedLocation.lon).y}
              r="3"
              fill="#ef4444"
            />
          </g>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <g>
            <rect
              x={dimensions.width / 2 - 50}
              y={dimensions.height / 2 - 15}
              width="100"
              height="30"
              fill="rgba(15, 23, 42, 0.9)"
              rx="6"
            />
            <text
              x={dimensions.width / 2}
              y={dimensions.height / 2 + 5}
              textAnchor="middle"
              fill="#60a5fa"
              fontSize="12"
            >
              Loading...
            </text>
          </g>
        )}
      </svg>

      <p className="map-instructions">
        Click anywhere on the map or select a city to view altitude data
      </p>
    </div>
  );
}
