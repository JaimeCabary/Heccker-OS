import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from './theme'
import App from './App'

// Register the background Service Worker for proactive notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Tell the SW what API URL to use
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const send = (r) => r.active?.postMessage({ type: 'INIT', payload: { apiUrl } })
      if (reg.active) {
        send(reg)
      } else {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing
          w?.addEventListener('statechange', () => { if (w.state === 'activated') send(reg) })
        })
      }
      // Expose globally so App.jsx can postMessage to SW
      window.__heckkerSW = reg
    }).catch((err) => console.warn('[SW] Registration failed:', err))

    // Forward incoming SW messages to the app via a custom event
    navigator.serviceWorker.addEventListener('message', (e) => {
      window.dispatchEvent(new CustomEvent('sw_message', { detail: e.data }))
    })
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>
)
