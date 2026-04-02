import '@mantine/core/styles.css'
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import EmbeddedChessApp from '../apps/chess/EmbeddedChessApp'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Embedded chess root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <EmbeddedChessApp />
  </StrictMode>
)
