import { createFileRoute } from '@tanstack/react-router'
import EmbeddedChessApp from '../../../apps/chess/EmbeddedChessApp'

export const Route = createFileRoute('/embedded/chess')({
  component: EmbeddedChessRoute,
})

function EmbeddedChessRoute() {
  return <EmbeddedChessApp />
}
