import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ConfirmationProvider } from './components/ConfirmationModal.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfirmationProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfirmationProvider>
  </StrictMode>,
)
