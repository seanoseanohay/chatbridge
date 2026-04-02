import { Stack } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { ChatBridgeAuthPanel } from '../../../plugin-runtime/AuthPanel'

export const Route = createFileRoute('/settings/chatbridge')({
  component: RouteComponent,
})

export function RouteComponent() {
  return (
    <Stack p="lg" maw={560}>
      <ChatBridgeAuthPanel showCard={false} />
    </Stack>
  )
}
