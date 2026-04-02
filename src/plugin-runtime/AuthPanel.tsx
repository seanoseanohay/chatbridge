import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { getDefaultStore, useAtomValue, useSetAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { clearPluginAuthToken, getPluginAuthToken, initializePluginAuth, persistPluginAuthToken } from './auth'
import { getPluginBackendUrl } from './registry'
import * as atoms from '@/stores/atoms'

export function ChatBridgeAuthPanel({
  title = 'ChatBridge',
  description = 'Sign in to ChatBridge to enable backend-powered apps and registry loading.',
  showCard = true,
}: {
  title?: string
  description?: string
  showCard?: boolean
}) {
  const [email, setEmail] = useState('student@example.com')
  const [password, setPassword] = useState('chatbridge-demo')
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [error, setError] = useState<string>()
  const [success, setSuccess] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [hasStoredAuth, setHasStoredAuth] = useState(Boolean(getPluginAuthToken()))
  const refreshRegistry = useSetAtom(atoms.refreshPluginRegistryAtom)
  const registryStatus = useAtomValue(atoms.pluginRegistryStatusAtom)

  useEffect(() => {
    void initializePluginAuth().then((token) => setHasStoredAuth(Boolean(token)))
  }, [])

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

      await persistPluginAuthToken(payload.token)
      await refreshRegistry()
      const nextRegistryState = getDefaultStore().get(atoms.pluginRegistryStatusAtom)
      setHasStoredAuth(true)
      setSuccess(
        `Authenticated. Registry status: ${nextRegistryState.status}. Return to chat and launch an app.`
      )
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError))
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    setError(undefined)
    setSuccess(undefined)
    try {
      await clearPluginAuthToken()
      await refreshRegistry()
      const nextRegistryState = getDefaultStore().get(atoms.pluginRegistryStatusAtom)
      setHasStoredAuth(false)
      setSuccess(`Signed out. Registry status: ${nextRegistryState.status}.`)
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : String(logoutError))
    } finally {
      setLoading(false)
    }
  }

  const content = (
    <Stack gap="md">
      <div>
        <Title order={2}>{title}</Title>
        <Text size="sm" c="dimmed">
          {description}
        </Text>
      </div>

      <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
      <PasswordInput label="Password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} />

      <div className="flex gap-2">
        <Button variant={mode === 'register' ? 'filled' : 'light'} onClick={() => setMode('register')}>
          Register
        </Button>
        <Button variant={mode === 'login' ? 'filled' : 'light'} onClick={() => setMode('login')}>
          Login
        </Button>
        {hasStoredAuth && (
          <Button variant="light" color="red" onClick={logout}>
            Logout
          </Button>
        )}
      </div>

      <Button loading={loading} onClick={submit}>
        {mode === 'register' ? 'Create Local Account' : 'Login to ChatBridge'}
      </Button>

      <Text size="sm">Backend: {getPluginBackendUrl()}</Text>
      <Text size="sm">Registry status: {registryStatus.status}</Text>
      <Text size="sm">Auth: {hasStoredAuth ? 'stored' : 'not authenticated'}</Text>

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
  )

  if (!showCard) {
    return content
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-chatbox-background-primary p-6">
      <Paper shadow="md" radius="lg" p="xl" className="w-full max-w-md">
        {content}
      </Paper>
    </div>
  )
}
