import { Alert, Button, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconCheck, IconRefresh } from '@tabler/icons-react'
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
  const { appId, sessionId, src, origin, srcDoc, initConfig, completed, onError, onReady } = props
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const initRetryRef = useRef<number | null>(null)
  const [frameWindow, setFrameWindow] = useState<Window | null>(null)
  const [status, setStatus] = useState<FrameStatus>('loading')
  const [error, setError] = useState<string>()

  const originMatches = useMemo(() => {
    if (srcDoc) {
      return true
    }
    return getOrigin(src) === origin
  }, [origin, src, srcDoc])

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
      clearReadyTimeout()
      setStatus('error')
      setError(message)
      markAppFrameStatus(sessionId, 'error', message)
      onError?.(message)
    },
    [clearReadyTimeout, onError, sessionId]
  )

  const sendInit = useCallback(() => {
    if (!originMatches) {
      reportError(`Blocked app "${appId}" because iframe origin does not match the registry allowlist`)
      return
    }

    try {
      setStatus('loading')
      setError(undefined)
      const initEvent = {
        type: 'INIT_APP' as const,
        sessionId,
        config: initConfig || {},
      }
      sendToApp(iframeRef.current, initEvent)
      clearReadyTimeout()
      initRetryRef.current = window.setInterval(() => {
        try {
          sendToApp(iframeRef.current, initEvent)
        } catch {
          // Ignore transient iframe readiness races while the child app boots.
        }
      }, INIT_RETRY_MS)
      timeoutRef.current = window.setTimeout(() => {
        reportError('App did not become ready within 10 seconds')
      }, FRAME_TIMEOUT_MS)
    } catch (initError) {
      reportError(initError instanceof Error ? initError.message : String(initError))
    }
  }, [appId, clearReadyTimeout, initConfig, originMatches, reportError, sessionId])

  useEffect(() => {
    if (!frameWindow) {
      return
    }

    return registerAppListener(
      sessionId,
      (event) => {
        switch (event.type) {
          case 'APP_READY':
            clearReadyTimeout()
            setStatus('ready')
            setError(undefined)
            markAppFrameStatus(sessionId, 'ready')
            onReady?.()
            break
          case 'APP_ERROR':
            reportError(event.error)
            break
          case 'APP_COMPLETE':
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
  }, [clearReadyTimeout, frameWindow, onReady, reportError, sessionId])

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
    if (nextWindow) {
      sendInit()
    }
  }, [sendInit, sessionId])

  return (
    <Stack gap="xs" className="rounded-2xl border border-solid border-chatbox-border-primary bg-chatbox-background-secondary p-3">
      <div className="flex items-center justify-between gap-2">
        <Text fw={600} size="sm">
          {appId}
        </Text>
        {status === 'completed' && (
          <Text size="xs" c="green">
            <span className="inline-flex items-center gap-1">
              <IconCheck size={14} />
              Completed
            </span>
          </Text>
        )}
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
