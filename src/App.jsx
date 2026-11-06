import { Navigate, Route, Routes } from 'react-router-dom';
import VisualizationPage from './pages/VisualizationPage';
import AltitudePage from './pages/AltitudePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/visualization" replace />} />
      <Route path="/visualization" element={<VisualizationPage />} />
      <Route path="/altitude" element={<AltitudePage />} />
    </Routes>
  );
}
