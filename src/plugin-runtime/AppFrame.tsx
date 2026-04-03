import { ActionIcon, Alert, Button, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconCheck, IconRefresh, IconX } from '@tabler/icons-react'
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { registerAppListener, sendToApp } from './eventBus'
import { markAppFrameStatus, registerAppFrame } from './runtime'

type FrameStatus = 'loading' | 'ready' | 'error' | 'completed'

export interface AppFrameProps {
  appId: string
  sessionId: string
  src: string
  origin: string
  srcDoc?: string
  initConfig?: Record<string, unknown>
  completed?: boolean
  onReady?: () => void
  onError?: (error: string) => void
  onClose?: () => void
}

const FRAME_TIMEOUT_MS = 10_000
const INIT_RETRY_MS = 300

const frameStyle: CSSProperties = {
  width: '100%',
  height: 'clamp(520px, 68vh, 760px)',
  border: 0,
  borderRadius: 16,
  background: 'var(--mantine-color-body)',
}

function getOrigin(value: string): string | null {
  try {
    return new URL(value, window.location.origin).origin
  } catch {
    return null
  }
}

export default function AppFrame(props: AppFrameProps) {
  const { appId, sessionId, src, origin, srcDoc, initConfig, completed, onError, onReady, onClose } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const initRetryRef = useRef<number | null>(null)
  const initAckRef = useRef(false)
  const [frameWindow, setFrameWindow] = useState<Window | null>(null)
  const [status, setStatus] = useState<FrameStatus>('loading')
  const [error, setError] = useState<string>()
  const [spotifyConnectLoading, setSpotifyConnectLoading] = useState(false)

  const logSpotify = useCallback(
    (message: string, details?: Record<string, unknown>) => {
      if (appId !== 'spotify-v1') {
        return
      }
      console.info('[plugin-runtime] spotify ' + message, {
        sessionId,
        ...(details || {}),
      })
    },
    [appId, sessionId]
  )

  const originMatches = useMemo(() => {
    if (srcDoc) {
      return true
    }
    return getOrigin(src) === origin
  }, [origin, src, srcDoc])
  const useLoadReady = Boolean(srcDoc)

  const buildInitEvent = useCallback(
    () => ({
      type: 'INIT_APP' as const,
      sessionId,
      config: initConfig || {},
    }),
    [initConfig, sessionId]
  )

  const clearReadyTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (initRetryRef.current !== null) {
      window.clearInterval(initRetryRef.current)
      initRetryRef.current = null
    }
  }, [])

  const reportError = useCallback(
    (message: string) => {
      logSpotify('frame:error', { message })
      clearReadyTimeout()
      setStatus('error')
      setError(message)
      markAppFrameStatus(sessionId, 'error', message)
      onError?.(message)
    },
    [clearReadyTimeout, logSpotify, onError, sessionId]
  )

  const sendInit = useCallback(() => {
    if (!originMatches) {
      reportError(`Blocked app "${appId}" because iframe origin does not match the registry allowlist`)
      return
    }

    try {
      logSpotify('frame:init:send', {
        useLoadReady,
        originMatches,
      })
      if (!useLoadReady) {
        setStatus('loading')
        setError(undefined)
      }
      initAckRef.current = false
      const initEvent = buildInitEvent()
      sendToApp(iframeRef.current, initEvent)
      clearReadyTimeout()
      initRetryRef.current = window.setInterval(() => {
        if (initAckRef.current) {
          clearReadyTimeout()
          return
        }
        try {
          sendToApp(iframeRef.current, initEvent)
        } catch {
          // Ignore transient iframe readiness races while the child app boots.
        }
      }, INIT_RETRY_MS)
      if (useLoadReady) {
        timeoutRef.current = window.setTimeout(() => {
          clearReadyTimeout()
        }, 2_000)
        return
      }
      timeoutRef.current = window.setTimeout(() => {
        reportError('App did not become ready within 10 seconds')
      }, FRAME_TIMEOUT_MS)
    } catch (initError) {
      reportError(initError instanceof Error ? initError.message : String(initError))
    }
  }, [appId, buildInitEvent, clearReadyTimeout, logSpotify, originMatches, reportError, sessionId, useLoadReady])

  useEffect(() => {
    if (!frameWindow) {
      return
    }

    return registerAppListener(
      sessionId,
      (event) => {
        switch (event.type) {
          case 'APP_READY':
            logSpotify('frame:event:ready')
            initAckRef.current = true
            clearReadyTimeout()
            setStatus('ready')
            setError(undefined)
            markAppFrameStatus(sessionId, 'ready')
            onReady?.()
            break
          case 'APP_STATE_UPDATE':
            logSpotify('frame:event:state-update', { stateSummary: event.stateSummary })
            initAckRef.current = true
            clearReadyTimeout()
            break
          case 'APP_ERROR':
            logSpotify('frame:event:error', { error: event.error })
            reportError(event.error)
            break
          case 'APP_COMPLETE':
            logSpotify('frame:event:complete', { result: event.result })
            clearReadyTimeout()
            setStatus('completed')
            markAppFrameStatus(sessionId, 'completed')
            break
          default:
            break
        }
      },
      { sourceWindow: frameWindow }
    )
  }, [clearReadyTimeout, frameWindow, logSpotify, onReady, reportError, sessionId])

  useEffect(() => {
    if (!frameWindow) {
      return
    }

    sendInit()
  }, [frameWindow, sendInit])

  useEffect(() => {
    if (appId !== 'spotify-v1') {
      return
    }

    const handleSpotifyOAuthMessage = (rawEvent: MessageEvent) => {
      const event = rawEvent.data
      if (!event || typeof event !== 'object' || event.type !== 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE') {
        return
      }

      setSpotifyConnectLoading(false)

      if (event.ok) {
        logSpotify('oauth:complete', { ok: true })
        setStatus('loading')
        setError(undefined)
        sendInit()
        return
      }

      logSpotify('oauth:complete', { ok: false, error: event.error })
      reportError(typeof event.error === 'string' ? event.error : 'Spotify connection failed')
    }

    window.addEventListener('message', handleSpotifyOAuthMessage)
    return () => {
      window.removeEventListener('message', handleSpotifyOAuthMessage)
    }
  }, [appId, logSpotify, reportError, sendInit])

  useEffect(() => {
    return () => {
      clearReadyTimeout()
      registerAppFrame(sessionId, null)
    }
  }, [clearReadyTimeout, sessionId])

  useEffect(() => {
    if (completed) {
      clearReadyTimeout()
      setStatus('completed')
      markAppFrameStatus(sessionId, 'completed')
    }
  }, [clearReadyTimeout, completed, sessionId])

  const onFrameLoad = useCallback(() => {
    const iframe = iframeRef.current
    const nextWindow = iframe?.contentWindow || null
    registerAppFrame(sessionId, iframe || null)
    setFrameWindow(nextWindow)
    initAckRef.current = false
    logSpotify('frame:load', {
      hasContentWindow: Boolean(nextWindow),
      useLoadReady,
    })
    if (useLoadReady) {
      try {
        sendToApp(iframe, buildInitEvent())
        initAckRef.current = true
      } catch (error) {
        reportError(error instanceof Error ? error.message : String(error))
        return
      }
      clearReadyTimeout()
      setStatus('ready')
      setError(undefined)
      markAppFrameStatus(sessionId, 'ready')
      onReady?.()
    }
  }, [buildInitEvent, clearReadyTimeout, logSpotify, onReady, reportError, sessionId, useLoadReady])

  const handleSpotifyConnect = useCallback(async () => {
    const backendUrl = typeof initConfig?.backendUrl === 'string' ? initConfig.backendUrl : ''
    const authToken = typeof initConfig?.authToken === 'string' ? initConfig.authToken : ''

    if (!backendUrl || !authToken) {
      logSpotify('oauth:connect:blocked', {
        hasBackendUrl: Boolean(backendUrl),
        hasAuthToken: Boolean(authToken),
      })
      reportError('Sign in to ChatBridge before connecting Spotify')
      return
    }

    setSpotifyConnectLoading(true)
    logSpotify('oauth:connect:start', {
      backendUrl,
    })
    try {
      const response = await fetch(
        `${backendUrl.replace(/\/$/, '')}/api/oauth/spotify/connect?sessionId=${encodeURIComponent(sessionId)}`,
        {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
        }
      )

      const payload = (await response.json()) as { authorizeUrl?: string; error?: string }
      logSpotify('oauth:connect:response', {
        ok: response.ok,
        status: response.status,
        payload,
      })
      if (!response.ok || !payload.authorizeUrl) {
        throw new Error(payload.error || 'Failed to start Spotify connection')
      }

      const popup = window.open(payload.authorizeUrl, 'chatbridge-spotify-oauth', 'width=520,height=740')
      if (!popup) {
        throw new Error('Popup blocked. Allow popups, then try connecting Spotify again.')
      }
    } catch (connectError) {
      setSpotifyConnectLoading(false)
      logSpotify('oauth:connect:error', {
        error: connectError instanceof Error ? connectError.message : String(connectError),
      })
      reportError(connectError instanceof Error ? connectError.message : String(connectError))
    }
  }, [initConfig?.authToken, initConfig?.backendUrl, logSpotify, reportError, sessionId])

  return (
    <Stack gap="xs" className="rounded-2xl border border-solid border-chatbox-border-primary bg-chatbox-background-secondary p-3">
      <div className="flex items-center justify-between gap-2">
        <Text fw={600} size="sm">
          {appId}
        </Text>
        <div className="flex items-center gap-2">
          {appId === 'spotify-v1' && status !== 'completed' && (
            <Button size="xs" variant="light" loading={spotifyConnectLoading} onClick={() => void handleSpotifyConnect()}>
              Connect Spotify
            </Button>
          )}
          {status === 'completed' && (
            <Text size="xs" c="green">
              <span className="inline-flex items-center gap-1">
                <IconCheck size={14} />
                Completed
              </span>
            </Text>
          )}
          <ActionIcon aria-label="Close app" size="sm" variant="subtle" onClick={onClose}>
            <IconX size={16} />
          </ActionIcon>
        </div>
      </div>

      {status === 'error' && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="App unavailable">
          <Stack gap="sm">
            <Text size="sm">{error || 'The app failed to load.'}</Text>
            <div>
              <Button leftSection={<IconRefresh size={16} />} size="xs" variant="light" onClick={sendInit}>
                Retry
              </Button>
            </div>
          </Stack>
        </Alert>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-chatbox-border-primary px-3 py-2">
          <Loader size="sm" />
          <Text size="sm">Loading app...</Text>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title={`${appId}-${sessionId}`}
        src={srcDoc ? undefined : src}
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-forms"
        style={{
          ...frameStyle,
          display: status === 'error' ? 'none' : 'block',
          opacity: status === 'loading' ? 0.7 : 1,
        }}
        onLoad={onFrameLoad}
      />
    </Stack>
  )
}
