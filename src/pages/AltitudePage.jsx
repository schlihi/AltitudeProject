import { useState, useCallback } from 'react';
import PageHeader from '../components/PageHeader';
import LeafletMap from '../components/LeafletMap';
import ElevationProfile from '../components/ElevationProfile';
import { fetchElevationProfile } from '../services/usgsElevationService';

export default function AltitudePage() {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [selectionMode, setSelectionMode] = useState('start'); // 'start' or 'end'
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
      
      // Fetch elevation profile
      setIsLoading(true);
      try {
        const profile = await fetchElevationProfile(
          startPoint.lat, 
          startPoint.lon, 
          lat, 
          lon,
          50
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

  return (
    <main className="page-shell">
      <PageHeader
        title="Terrain Elevation Explorer"
        description="Click two points on the map to view the terrain elevation profile between them."
      />

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
    </main>
  );
}
