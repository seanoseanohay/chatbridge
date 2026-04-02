import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { createFileRoute } from '@tanstack/react-router'
import { useAtomValue, useSetAtom } from 'jotai'
import { useState } from 'react'
import { getPluginBackendUrl } from '../../plugin-runtime/registry'
import { setPluginAuthToken } from '../../plugin-runtime/auth'
import * as atoms from '@/stores/atoms'

export const Route = createFileRoute('/chatbridge-auth')({
  component: ChatBridgeAuthPage,
})

function ChatBridgeAuthPage() {
  const [email, setEmail] = useState('student@example.com')
  const [password, setPassword] = useState('chatbridge-demo')
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [loading, setLoading] = useState(false)
  const refreshRegistry = useSetAtom(atoms.refreshPluginRegistryAtom)
  const registryStatus = useAtomValue(atoms.pluginRegistryStatusAtom)

  const submit = async () => {
    setLoading(true)
    setError(undefined)
    setSuccess(undefined)

    try {
      const response = await fetch(`${getPluginBackendUrl()}/api/auth/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      })

      const payload = (await response.json()) as { token?: string; error?: string }
      if (!response.ok || !payload.token) {
        throw new Error(payload.error || `${mode} failed`)
      }

      setPluginAuthToken(payload.token)
      await refreshRegistry()
      setSuccess(`Authenticated. Registry status: ${registryStatus.status}. Open the chat shell and try "let's play chess".`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-chatbox-background-primary p-6">
      <Paper shadow="md" radius="lg" p="xl" className="w-full max-w-md">
        <Stack gap="md">
          <div>
            <Title order={2}>ChatBridge Auth</Title>
            <Text size="sm" c="dimmed">
              This is a temporary Phase 2 login page for local testing against the ChatBridge backend.
            </Text>
          </div>

          <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          <PasswordInput
            label="Password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />

          <div className="flex gap-2">
            <Button variant={mode === 'register' ? 'filled' : 'light'} onClick={() => setMode('register')}>
              Register
            </Button>
            <Button variant={mode === 'login' ? 'filled' : 'light'} onClick={() => setMode('login')}>
              Login
            </Button>
          </div>

          <Button loading={loading} onClick={submit}>
            {mode === 'register' ? 'Create Local Account' : 'Login to ChatBridge'}
          </Button>

          <Text size="sm">Backend: {getPluginBackendUrl()}</Text>
          <Text size="sm">Registry status: {registryStatus.status}</Text>

          {error && (
            <Alert color="red" title="Auth failed">
              {error}
            </Alert>
          )}
          {success && (
            <Alert color="green" title="Ready">
              {success}
            </Alert>
          )}
        </Stack>
      </Paper>
    </div>
  )
}
