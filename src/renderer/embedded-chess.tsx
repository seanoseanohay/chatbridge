import '@mantine/core/styles.css'
import { MantineProvider } from '@mantine/core'
import { StrictMode, Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import EmbeddedChessApp from '../apps/chess/EmbeddedChessApp'

type BoundaryState = {
  error: Error | null
}

class EmbeddedErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[embedded-chess] render failed', error)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: '#2b1e1e',
            color: '#ffe5e5',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          }}
        >
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
            {`Embedded chess failed to render.\n\n${this.state.error.stack || this.state.error.message}`}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Embedded chess root element not found')
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <EmbeddedErrorBoundary>
        <EmbeddedChessApp />
      </EmbeddedErrorBoundary>
    </MantineProvider>
  </StrictMode>
)
