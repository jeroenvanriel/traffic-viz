import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ScenePage from './pages/ScenePage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/scene/:sceneId" element={<ScenePage />} />
    </Routes>
  )
}

export default App;