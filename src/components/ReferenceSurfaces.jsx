import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useReferenceSurfaces } from '../hooks/useReferenceSurfaces';

// Map click capturer
function MapClickCapturer({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function ReferenceSurfaces() {
  const { selectedLocation, surfaceData, isLoading, selectLocation } = useReferenceSurfaces();
  
  const [droneAltitude, setDroneAltitude] = useState(0); 
  const isDragging = useRef(false);

  // Snap drone to terrain when data loads
  useEffect(() => {
    if (surfaceData) {
      setDroneAltitude(surfaceData.terrainElevation);
    }
  }, [surfaceData]);

  // ==========================================
  // THE MATH: METERS TO PIXELS SCALING
  // ==========================================
  
  // Default values to prevent crashing before data loads
  let H = 0; // Terrain
  let N = 0; // Geoid Undulation
  let minMeters = -100;
  let maxMeters = 100;
  let rangeMeters = 200;
  
  // Height of the CSS box where we draw the diagram (must match your CSS!)
  const BOX_HEIGHT_PX = 400; 

  if (surfaceData) {
    H = surfaceData.terrainElevation;
    N = surfaceData.geoidUndulation;

    // Find the highest and lowest points on our graph
    // (Drone might fly higher than the terrain, so we include it in the max)
    const highestPoint = Math.max(H, 0, -N, droneAltitude);
    const lowestPoint = Math.min(H, 0, -N);

    // Add 50 meters of visual "padding" above and below so lines don't hit the box edges
    maxMeters = highestPoint + 50;
    minMeters = lowestPoint - 50;
    rangeMeters = maxMeters - minMeters;
  }

  // Helper function: Converts a meter value into a CSS percentage for the "bottom" property
  const getBottomPercent = (meters) => {
    return ((meters - minMeters) / rangeMeters) * 100;
  };

  // ==========================================
  // DRAG LOGIC
  // ==========================================

  const handlePointerDown = (e) => {
    isDragging.current = true;
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || !surfaceData) return;
    
    // Convert the mouse movement (pixels) back into meters
    const pixelsPerMeter = BOX_HEIGHT_PX / rangeMeters;
    
    // Negative because moving the mouse UP means movementY is negative, but altitude increases
    const metersMoved = -e.movementY / pixelsPerMeter; 
    
    setDroneAltitude((prev) => {
      let newAlt = prev + metersMoved;
      // CONSTRAINT: Drone cannot go below the terrain
      if (newAlt < H) return H;
      return newAlt;
    });
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  // Telemetry Calculations
  const agl = surfaceData ? droneAltitude - H : 0;
  const droneWGS84 = surfaceData ? droneAltitude + N : 0;

  return (
    <div className="reference-surfaces-container">
      {/* LEFT SIDE: MAP */}
      <div className="map-section">
        <h3>Select a Location</h3>
        <MapContainer center={[39.0, -98.0]} zoom={4} style={{ height: '400px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickCapturer onLocationSelect={selectLocation} />
          {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lon]} />}
        </MapContainer>
      </div>

      {/* RIGHT SIDE: SIDE VIEW */}
      <div className="side-view-section">
        {isLoading && <p>Calculating reference surfaces...</p>}
        
        {surfaceData && (
          <div className="interactive-cross-section">
            
            <div className="drone-dashboard">
              <h4>🚁 Drone Telemetry</h4>
              <p><strong>AGL (Above Ground):</strong> {agl.toFixed(1)} m</p>
              <p><strong>MSL (Above Geoid):</strong> {droneAltitude.toFixed(1)} m</p>
              <p><strong>GPS/WGS84 Height:</strong> {droneWGS84.toFixed(1)} m</p>
            </div>

            <div className="diagram-box">
               
               {/* 1. ELLIPSOID LINE (Position: -N) */}
               <div 
                 className="line ellipsoid-line" 
                 style={{ bottom: `${getBottomPercent(-N)}%` }}
               >
                 WGS84 Ellipsoid
               </div>

               {/* 2. GEOID / MSL LINE (Position: 0) */}
               <div 
                 className="line geoid-line" 
                 style={{ bottom: `${getBottomPercent(0)}%` }}
               >
                 Geoid (Mean Sea Level)
               </div>

               {/* 3. TERRAIN LINE (Position: H) */}
               <div 
                 className="line terrain-line" 
                 style={{ bottom: `${getBottomPercent(H)}%` }}
               >
                 Terrain Surface
               </div>

               {/* (Optional Visual Bonus) A block of color representing the solid ground below the terrain line */}
               <div 
                 style={{
                   position: 'absolute',
                   bottom: 0,
                   width: '100%',
                   height: `${getBottomPercent(H)}%`,
                   backgroundColor: 'rgba(139, 69, 19, 0.4)', // transparent brown
                   borderTop: '2px solid #8b4513'
                 }}
               />

               {/* 4. THE DRONE */}
               <div 
                 className="drone-icon"
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerCancel={handlePointerUp}
                 style={{ 
                   bottom: `${getBottomPercent(droneAltitude)}%`,
                   // We add margin-bottom so the bottom of the drone icon touches the line, 
                   // rather than the invisible center of the text box
                   marginBottom: '-15px' 
                 }}
               >
                 🚁
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}