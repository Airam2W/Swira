import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const routeToRestore = new URLSearchParams(window.location.search).get('swira-route')
if (routeToRestore?.startsWith('/Swira/')) {
  window.history.replaceState({}, '', routeToRestore)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
