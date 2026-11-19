import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { useReferenceSurfaces } from '../hooks/useReferenceSurfaces';

function MapClickCapturer({ onLocationSelect }) {
  useMapEvents({
    click(e) { 
      // Hardcoded to always fetch a crisp 5km slice instantly
      onLocationSelect(e.latlng.lat, e.latlng.lng, 5); 
    }
  });
  return null;
}

export default function ReferenceSurfaces() {
  const { selectedLocation, surfaceData, isLoading, selectLocation } = useReferenceSurfaces();
  
  const [dronePos, setDronePos] = useState({ x: 0, y: 0 }); 
  
  const [verticalCeiling, setVerticalCeiling] = useState(1000);   
  
  const isDragging = useRef(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (surfaceData && surfaceData.length > 0) {
      const middlePoint = surfaceData[Math.floor(surfaceData.length / 2)];
      setDronePos({ x: middlePoint.distance, y: middlePoint.H });
    }
  }, [surfaceData]);


  let minMeters = -100;
  let maxMeters = 100;
  let rangeMeters = 200;
  let totalDistance = 5000; 
  let currentDataPoint = null;

  if (surfaceData && surfaceData.length > 0) {
    totalDistance = surfaceData[surfaceData.length - 1].distance;

    let lowest = 0;
    surfaceData.forEach(p => { lowest = Math.min(lowest, p.H, 0, -p.N); });
    minMeters = lowest - 50; 

    let autoHighest = dronePos.y;
    surfaceData.forEach(p => { autoHighest = Math.max(autoHighest, p.H, 0, -p.N); });
    let autoMaxMeters = autoHighest + 50;

    maxMeters = Math.max(autoMaxMeters, verticalCeiling);
    rangeMeters = maxMeters - minMeters;

    currentDataPoint = surfaceData.reduce((prev, curr) => 
      Math.abs(curr.distance - dronePos.x) < Math.abs(prev.distance - dronePos.x) ? curr : prev
    );
  }

  const getXPercent = (dist) => (dist / totalDistance) * 100;
  const getYPercent = (meters) => ((meters - minMeters) / rangeMeters) * 100;
  const getSvgY = (meters) => 100 - getYPercent(meters); 



  const handlePointerDown = (e) => {
    isDragging.current = true;
    e.target.setPointerCapture(e.pointerId); 
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current || !surfaceData || !boxRef.current) return;
    
    const boxRect = boxRef.current.getBoundingClientRect();
    const pixelsPerMeterX = boxRect.width / totalDistance;
    const pixelsPerMeterY = boxRect.height / rangeMeters;
    
    const metersMovedX = e.movementX / pixelsPerMeterX;
    const metersMovedY = -e.movementY / pixelsPerMeterY; 
    
    setDronePos((prev) => {
      let newX = prev.x + metersMovedX;
      let newY = prev.y + metersMovedY;

      if (newX < 0) newX = 0;
      if (newX > totalDistance) newX = totalDistance;

      const nearestPoint = surfaceData.reduce((prevPt, currPt) => 
        Math.abs(currPt.distance - newX) < Math.abs(prevPt.distance - newX) ? currPt : prevPt
      );
      
      if (newY < nearestPoint.H) newY = nearestPoint.H;

      return { x: newX, y: newY };
    });
  };

  const handlePointerUp = () => { isDragging.current = false; };



  let geoidPath = "";
  let ellipsoidPath = "";
  let terrainPath = "";

  if (surfaceData) {
    geoidPath = surfaceData.map((p, i) => `${i===0?'M':'L'} ${getXPercent(p.distance)} ${getSvgY(0)}`).join(' ');
    ellipsoidPath = surfaceData.map((p, i) => `${i===0?'M':'L'} ${getXPercent(p.distance)} ${getSvgY(-p.N)}`).join(' ');
    terrainPath = surfaceData.map((p, i) => `${i===0?'M':'L'} ${getXPercent(p.distance)} ${getSvgY(p.H)}`).join(' ');
  }

  return (
    <div className="reference-surfaces-container">
      <div className="map-section">
        <h3>Select a Location</h3>

        <MapContainer center={[39.0, -98.0]} zoom={4} style={{ height: '400px', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapClickCapturer onLocationSelect={selectLocation} />
          {selectedLocation && <Marker position={[selectedLocation.lat, selectedLocation.lon]} />}
        </MapContainer>
      </div>

      <div className="side-view-section">
        {(!surfaceData && isLoading) && <p>Fetching altitude data...</p>}
        
        {surfaceData && currentDataPoint && (
          <div className="interactive-cross-section">
            
            <div className="drone-dashboard">
              <h4>Altitude Data</h4>
              <p><strong>Location:</strong> {currentDataPoint.lat.toFixed(4)}°, {currentDataPoint.lon.toFixed(4)}°</p>
              <p><strong>AGL:</strong> {(dronePos.y - currentDataPoint.H).toFixed(1)} m</p>
              <p><strong>MSL:</strong> {dronePos.y.toFixed(1)} m</p>
              <p><strong>WGS84:</strong> {(dronePos.y + currentDataPoint.N).toFixed(1)} m</p>
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', background: 'rgba(15, 23, 42, 0.8)', padding: '15px', borderRadius: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px' }}>
                  Vertical Range
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="20000" 
                  step="100"
                  value={verticalCeiling} 
                  onChange={(e) => setVerticalCeiling(parseInt(e.target.value))}
                  style={{ cursor: 'pointer', accentColor: '#22c55e' }}
                />
              </div>
            </div>

            <div className="diagram-box" ref={boxRef} style={{ position: 'relative' }}>
               
               <svg 
                 viewBox="0 0 100 100" 
                 preserveAspectRatio="none" 
                 style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
               >
                 <path d={ellipsoidPath} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                 <path d={geoidPath} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                 <path d={terrainPath} fill="none" stroke="#f59e0b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
               </svg>

               {isLoading && (
                 <div style={{
                   position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
                   color: '#e5eefb', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(96, 165, 250, 0.5)',
                   padding: '12px 24px', borderRadius: '20px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                   display: 'flex', alignItems: 'center', gap: '12px'
                 }}>
                   <div className="loading-spinner" style={{width: '20px', height: '20px', borderWidth: '2px'}} />
                   Fetching data...
                 </div>
               )}

               <div style={{position: 'absolute', top: 10, left: 10, color: '#93c5fd', fontSize: '0.8rem'}}>WGS84 Ellipsoid</div>
               <div style={{position: 'absolute', top: 25, left: 10, color: '#86efac', fontSize: '0.8rem'}}>Geoid (MSL)</div>
               <div style={{position: 'absolute', top: 40, left: 10, color: '#fcd34d', fontSize: '0.8rem'}}>Terrain Surface</div>

               <div style={{ position: 'absolute', bottom: 0, width: '100%', height: '20px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                 {[0, 0.2, 0.4, 0.6, 0.8, 1].map((fraction) => (
                   <div 
                     key={fraction} 
                     style={{ 
                       position: 'absolute', 
                       left: `${fraction * 100}%`, 
                       bottom: '2px', 
                       transform: 'translateX(-50%)', 
                       textAlign: 'center',
                       pointerEvents: 'none' 
                     }}
                   >
                     <div style={{ width: '1px', height: '4px', backgroundColor: '#94a3b8', margin: '0 auto' }} />
                     <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                       {(fraction * 5).toFixed(1)} km
                     </span>
                   </div>
                 ))}
               </div>

               <div 
                 className="drone-icon"
                 onPointerDown={handlePointerDown}
                 onPointerMove={handlePointerMove}
                 onPointerUp={handlePointerUp}
                 onPointerCancel={handlePointerUp} 
                 style={{ 
                   left: `${getXPercent(dronePos.x)}%`,
                   bottom: `${getYPercent(dronePos.y)}%`,
                   marginBottom: '-15px',
                   cursor: isDragging.current ? 'grabbing' : 'grab',
                   zIndex: 10,
                   fontSize: '1.5rem'
                 }}
               >
                 ✈︎
               </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
