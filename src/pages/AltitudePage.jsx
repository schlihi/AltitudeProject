import { useState, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import LeafletMap from '../components/LeafletMap';
import ElevationProfile from '../components/ElevationProfile';
import { fetchElevationProfile } from '../services/usgsElevationService';
import ReferenceSurfaces from '../components/ReferenceSurfaces'; 

export default function AltitudePage() {
  const [activeView, setActiveView] = useState('menu'); 

  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState('start');
  const [profileData, setProfileData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handlePointSelect = useCallback(async (lat, lon) => {
    if (selectionMode === 'start') {
      setStartPoint({ lat, lon });
      setEndPoint(null);
      setProfileData(null);
      setSelectionMode('end');
    } else {
      setEndPoint({ lat, lon });
      setSelectionMode('start');
      
      setIsLoading(true);
      try {
        const profile = await fetchElevationProfile(
          startPoint.lat, startPoint.lon, lat, lon, 50
        );
        setProfileData(profile);
      } catch (err) {
        console.error('Failed to fetch elevation profile:', err);
        setProfileData([]);
      } finally {
        setIsLoading(false);
      }
    }
  }, [selectionMode, startPoint]);

  const handleReset = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setProfileData(null);
    setSelectionMode('start');
  }, []);

  let pageTitle = "Altitude Comparison";
  let pageDesc = "Select a tool to explore altitude reference surfaces or terrain elevation.";
  
  if (activeView === 'reference') {
    pageTitle = "Altitude Reference Surfaces";
    pageDesc = "Click anywhere on the map to generate a 2D cross-section and fly the interactive aircraft.";
  } else if (activeView === 'profile') {
    pageTitle = "Terrain Elevation Explorer";
    pageDesc = "Click two points on the map to view the terrain elevation profile between them.";
  }

  return (
    <main className="page-shell">
      <PageHeader title={pageTitle} description={pageDesc} />

      {activeView !== 'menu' && (
        <button 
          onClick={() => setActiveView('menu')}
          style={{ 
            marginBottom: '20px', 
            padding: '8px 16px', 
            background: 'rgba(15, 23, 42, 0.8)', 
            color: '#93c5fd', 
            border: '1px solid #3b82f6', 
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          ← Back
        </button>
      )}

      {activeView === 'menu' && (
        <div className="content-grid" style={{ marginTop: '20px' }}>
          
          <div 
            className="card" 
            onClick={() => setActiveView('reference')}
            style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid rgba(96, 165, 250, 0.5)' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#60a5fa', fontSize: '1.4rem' }}>Altitude Reference Surfaces</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Select a single location to instantly generate a scalable 2D cross-section. 
              Fly an interactive aircraft to compare across the WGS84 Ellipsoid, MSL Geoid, and actual Terrain surfaces.
            </p>
          </div>


          <div 
            className="card" 
            onClick={() => setActiveView('profile')}
            style={{ cursor: 'pointer', transition: 'transform 0.2s', border: '1px solid rgba(148, 163, 184, 0.3)' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-5px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <h3 style={{ color: '#e5eefb', fontSize: '1.4rem' }}>Terrain Elevation Explorer</h3>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>
              Select a start point and an end point on the map to generate a detailed 
              distance-to-elevation line graph of the physical terrain between the two coordinates.
            </p>
          </div>

        </div>
      )}

      {activeView === 'reference' && (
        <ReferenceSurfaces />
      )}

      {activeView === 'profile' && (
        <div className="altitude-page-layout">
          <div className="map-container-full">
            <LeafletMap
              startPoint={startPoint}
              endPoint={endPoint}
              onPointSelect={handlePointSelect}
              isLoading={isLoading}
              selectionMode={selectionMode}
            />
          </div>

          <div className="profile-container">
            <ElevationProfile
              profileData={profileData}
              startPoint={startPoint}
              endPoint={endPoint}
              isLoading={isLoading}
            />
            
            {(startPoint || endPoint) && (
              <button className="reset-button" onClick={handleReset}>
                Reset Selection
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}