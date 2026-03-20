import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScenePage from './pages/ScenePage';
import ModelLibraryPage from './pages/ModelLibraryPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scene/:sceneId" element={<ScenePage />} />
      <Route path="/models" element={<ModelLibraryPage /> } />
    </Routes>
  )
}

export default App;