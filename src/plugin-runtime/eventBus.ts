import { parseAppToPlatformEvent, parsePlatformToAppEvent, type AppToPlatformEvent, type PlatformToAppEvent } from './types'

interface AppListener {
  sessionId: string
  sourceWindow?: Window | null
  handler: (event: AppToPlatformEvent) => void
}

const listeners = new Map<string, Set<AppListener>>()

let messageHandlerInstalled = false

function isTrustedSandboxedEvent(rawEvent: MessageEvent) {
  return rawEvent.origin === 'null'
}

function installMessageHandler() {
  if (messageHandlerInstalled || typeof window === 'undefined') {
    return
  }

  window.addEventListener('message', (rawEvent: MessageEvent) => {
    if (
      rawEvent.data &&
      typeof rawEvent.data === 'object' &&
      (rawEvent.data.type === 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE' ||
        rawEvent.data.type === 'CHATBRIDGE_GITHUB_OAUTH_COMPLETE')
    ) {
      return
    }

    let parsedEvent: AppToPlatformEvent

    try {
      parsedEvent = parseAppToPlatformEvent(rawEvent.data)
    } catch (error) {
      console.warn('[plugin-runtime] Discarding invalid app event', rawEvent.data, error)
      return
    }

    if (parsedEvent.sessionId.includes('spotify')) {
      console.info('[plugin-runtime] spotify eventBus:receive', {
        type: parsedEvent.type,
        sessionId: parsedEvent.sessionId,
        rawEventOrigin: rawEvent.origin,
      })
    }

    const sessionListeners = listeners.get(parsedEvent.sessionId)
    if (!sessionListeners?.size) {
      return
    }

    for (const listener of sessionListeners) {
      if (
        listener.sourceWindow &&
        rawEvent.source &&
        listener.sourceWindow !== rawEvent.source &&
        !isTrustedSandboxedEvent(rawEvent)
      ) {
        continue
      }
      listener.handler(parsedEvent)
    }
  })

  messageHandlerInstalled = true
}

export function sendToApp(
  iframe: HTMLIFrameElement | null,
  event: PlatformToAppEvent,
  targetOrigin: string = '*'
): void {
  const parsedEvent = parsePlatformToAppEvent(event)
  const targetWindow = iframe?.contentWindow

  if (!targetWindow) {
    throw new Error('App iframe is not ready')
  }

  if (event.sessionId.includes('spotify')) {
    console.info('[plugin-runtime] spotify eventBus:send', {
      type: event.type,
      sessionId: event.sessionId,
      targetOrigin,
    })
  }

  targetWindow.postMessage(parsedEvent, targetOrigin)
}

export function registerAppListener(
  sessionId: string,
  handler: (event: AppToPlatformEvent) => void,
  options?: { sourceWindow?: Window | null }
): () => void {
  installMessageHandler()

  const listener: AppListener = {
    sessionId,
    sourceWindow: options?.sourceWindow,
    handler,
  }

  const sessionListeners = listeners.get(sessionId) || new Set<AppListener>()
  sessionListeners.add(listener)
  listeners.set(sessionId, sessionListeners)

  return () => {
    const currentListeners = listeners.get(sessionId)
    if (!currentListeners) {
      return
    }
    currentListeners.delete(listener)
    if (currentListeners.size === 0) {
      listeners.delete(sessionId)
    }
  }
}

export function __resetEventBusForTests() {
  listeners.clear()
}
