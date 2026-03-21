import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScenePage from './pages/ScenePage';
import ModelLibraryPage from './pages/ModelLibraryPage';
import ModelConfiguratorPage from './pages/ModelConfiguratorPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scene/:sceneId" element={<ScenePage />} />
      <Route path="/models" element={<ModelLibraryPage /> } />
      <Route path="/models/:modelId/configure" element={<ModelConfiguratorPage />} />
    </Routes>
  )
}

export default App;