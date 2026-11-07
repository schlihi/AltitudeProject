import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// US bounds for initial view
const US_CENTER = [39.8283, -98.5795];
const US_ZOOM = 4;

// Click handler component
function MapClickHandler({ onMapClick, isLoading }) {
  useMapEvents({
    click: (e) => {
      if (!isLoading) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function LeafletMap({ 
  startPoint, 
  endPoint, 
  onPointSelect, 
  isLoading,
  selectionMode 
}) {
  const mapRef = useRef(null);

  const handleMapClick = useCallback((lat, lon) => {
    onPointSelect(lat, lon);
  }, [onPointSelect]);

  // Draw line between points if both exist
  const linePositions = startPoint && endPoint 
    ? [[startPoint.lat, startPoint.lon], [endPoint.lat, endPoint.lon]]
    : null;

  return (
    <div className="leaflet-map-wrapper">
      <MapContainer
        center={US_CENTER}
        zoom={US_ZOOM}
        ref={mapRef}
        style={{ height: '100%', width: '100%', borderRadius: '12px' }}
        minZoom={3}
        maxZoom={18}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Invisible click layer */}
        <MapClickHandler onMapClick={handleMapClick} isLoading={isLoading} />
        
        {/* Start point marker */}
        {startPoint && (
          <Marker 
            position={[startPoint.lat, startPoint.lon]} 
            icon={startIcon}
          />
        )}
        
        {/* End point marker */}
        {endPoint && (
          <Marker 
            position={[endPoint.lat, endPoint.lon]} 
            icon={endIcon}
          />
        )}
        
        {/* Line between points */}
        {linePositions && (
          <Polyline 
            positions={linePositions}
            color="#3b82f6"
            weight={3}
            opacity={0.8}
            dashArray="10, 10"
          />
        )}
      </MapContainer>
      
      <div className="map-selection-indicator">
        {isLoading ? (
          <span className="loading-text">Loading elevation data...</span>
        ) : (
          <span>
            {selectionMode === 'start' 
              ? '📍 Click to set START point' 
              : '📍 Click to set END point'}
          </span>
        )}
      </div>
    </div>
  );
}