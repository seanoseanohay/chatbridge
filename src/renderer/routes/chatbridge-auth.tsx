import { createFileRoute } from '@tanstack/react-router'
import { ChatBridgeAuthPanel } from '../../plugin-runtime/AuthPanel'

export const Route = createFileRoute('/chatbridge-auth')({
  component: ChatBridgeAuthPage,
})

function ChatBridgeAuthPage() {
  return <ChatBridgeAuthPanel description="Temporary direct route for ChatBridge auth testing." />
}
