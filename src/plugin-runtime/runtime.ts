import { getDefaultStore } from 'jotai'
import { tool, type ToolExecutionOptions, type ToolSet } from 'ai'
import { z } from 'zod'
import { createChessAppSrcDoc } from '../apps/chess/srcdoc'
import { createWeatherAppSrcDoc } from '../apps/weather/srcdoc'
import { activeAppSessionAtom, pluginFramesAtom } from '../renderer/stores/atoms/uiAtoms'
import { getPluginAuthToken } from './auth'
import type { ActiveAppSessionRef, PluginFrameEntry } from './atoms'
import { registerAppListener, sendToApp } from './eventBus'
import { getPluginBackendUrl, getRegistryCache, resolveToolToApp } from './registry'
import type { AppResult, AppSession, AppToPlatformEvent, PluginRegistryEntry, ToolDefinition } from './types'
import { AppSessionSchema } from './types'

type PendingInvocation = {
  toolCallId: string
  seq: number
  toolName: string
  startedAt: number
  params: Record<string, unknown>
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

type RuntimeSession = {
  session: AppSession
  entry: PluginRegistryEntry
  frameToolCallId: string
  nextSeq: number
  lastSeq: number
  pendingBySeq: Map<number, PendingInvocation>
  unregister?: () => void
}

const INVOCATION_TIMEOUT_MS = 15_000
const iframeElements = new Map<string, HTMLIFrameElement>()
const runtimeSessions = new Map<string, RuntimeSession>()
const frameReadySessions = new Set<string>()
const frameWaiters = new Map<string, Set<{ resolve: () => void; reject: (error: Error) => void; timeoutId: number }>>()

function isLocalSessionId(sessionId: string) {
  return sessionId.startsWith('local-app-session-')
}

function supportsLocalRuntime(appId: string) {
  return appId === 'chess-v1' || appId === 'weather-v1'
}

function getAuthHeaders(): HeadersInit {
  const token = getPluginAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function setFrameEntry(toolCallId: string, entry: PluginFrameEntry) {
  const store = getDefaultStore()
  const current = store.get(pluginFramesAtom)
  store.set(pluginFramesAtom, {
    ...current,
    [toolCallId]: entry,
  })
}

function removeFrameEntry(toolCallId: string) {
  const store = getDefaultStore()
  const current = store.get(pluginFramesAtom)
  if (!(toolCallId in current)) {
    return
  }
  const next = { ...current }
  delete next[toolCallId]
  store.set(pluginFramesAtom, next)
}

function updateFrameEntry(toolCallId: string, updater: (entry: PluginFrameEntry) => PluginFrameEntry) {
  const store = getDefaultStore()
  const current = store.get(pluginFramesAtom)
  const entry = current[toolCallId]
  if (!entry) {
    return
  }
  store.set(pluginFramesAtom, {
    ...current,
    [toolCallId]: updater(entry),
  })
}

function setActiveSession(session: ActiveAppSessionRef | null) {
  getDefaultStore().set(activeAppSessionAtom, session)
}

function getLocalAppSource(appId: string) {
  if (appId === 'chess-v1') {
    return {
      src: 'about:blank',
      srcDoc: createChessAppSrcDoc(),
      origin: 'null',
    }
  }
  if (appId === 'weather-v1') {
    return {
      src: 'about:blank',
      srcDoc: createWeatherAppSrcDoc(),
      origin: 'null',
    }
  }
  return {
    src: 'about:blank',
    srcDoc: '<!DOCTYPE html><html><body>App unavailable.</body></html>',
    origin: 'null',
  }
}

function getLocalRuntimeConfig(appId: string) {
  if (appId === 'weather-v1') {
    return {
      openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',
    }
  }
  return {}
}

function buildSummaryText(session: RuntimeSession) {
  const summary = session.session.stateSummary || 'No app state available.'
  return `[ACTIVE APP: ${session.entry.manifest.name}]
Session: ${session.session.id}
Status: ${session.session.status}
Summary: ${summary}`
}

function ensureSummaryWithinLimit(summary: string) {
  const limit = 1200
  return summary.length <= limit ? summary : `${summary.slice(0, limit - 3)}...`
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getPluginBackendUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(init.headers || {}),
    },
  })

  if (response.status === 401) {
    throw new Error('Plugin backend authentication required')
  }

  if (!response.ok) {
    throw new Error(`Plugin backend request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

function jsonSchemaToZod(schema: Record<string, unknown>): z.ZodTypeAny {
  const type = schema.type
  if (type === 'string') {
    return z.string()
  }
  if (type === 'number' || type === 'integer') {
    return z.number()
  }
  if (type === 'boolean') {
    return z.boolean()
  }
  if (type === 'array') {
    const items = typeof schema.items === 'object' && schema.items ? jsonSchemaToZod(schema.items as Record<string, unknown>) : z.unknown()
    return z.array(items)
  }
  if (type === 'object' || schema.properties) {
    const properties = typeof schema.properties === 'object' && schema.properties ? (schema.properties as Record<string, Record<string, unknown>>) : {}
    const required = Array.isArray(schema.required) ? new Set(schema.required.filter((item): item is string => typeof item === 'string')) : new Set<string>()
    const shape = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => {
        const propertySchema = jsonSchemaToZod(value)
        return [key, required.has(key) ? propertySchema : propertySchema.optional()]
      })
    )
    return z.object(shape)
  }
  return z.record(z.string(), z.unknown())
}

function createPluginTool(definition: ToolDefinition, entry: PluginRegistryEntry, conversationId?: string) {
  return tool({
    description: definition.description,
    inputSchema: jsonSchemaToZod(definition.parameters),
    execute: async (input: unknown, options: ToolExecutionOptions) => {
      if (!conversationId) {
        throw new Error('Plugin tools require a conversation session id')
      }
      const params = typeof input === 'object' && input ? (input as Record<string, unknown>) : {}
      return invokePluginTool(definition.name, params, {
        conversationId,
        appId: entry.appId,
        toolCallId: options.toolCallId,
      })
    },
  })
}

function getRuntimeSessionByTool(toolName: string) {
  const entry = resolveToolToApp(toolName)
  const activeSession = getDefaultStore().get(activeAppSessionAtom)
  if (!activeSession || !entry || activeSession.appId !== entry.appId) {
    return null
  }
  return runtimeSessions.get(activeSession.sessionId) || null
}

function getFrameForSession(sessionId: string) {
  return iframeElements.get(sessionId) || null
}

function handleAppEvent(sessionId: string, event: AppToPlatformEvent) {
  const runtimeSession = runtimeSessions.get(sessionId)
  if (!runtimeSession) {
    return
  }

  switch (event.type) {
    case 'APP_STATE_UPDATE': {
      if (event.seq < runtimeSession.lastSeq) {
        return
      }
      runtimeSession.lastSeq = event.seq
      runtimeSession.session.stateSummary = event.stateSummary
      void patchAppSession(runtimeSession.session.id, {
        stateSummary: event.stateSummary,
      })
      setActiveSession({
        sessionId: runtimeSession.session.id,
        appId: runtimeSession.entry.appId,
        conversationId: runtimeSession.session.conversationId,
        messageId: runtimeSession.frameToolCallId,
        status: runtimeSession.session.status,
        stateSummary: event.stateSummary,
        result: runtimeSession.session.result,
      })
      updateFrameEntry(runtimeSession.frameToolCallId, (entry) => ({
        ...entry,
        status: entry.status === 'completed' ? entry.status : 'ready',
      }))
      break
    }
    case 'APP_RESULT': {
      const pending = runtimeSession.pendingBySeq.get(event.seq)
      if (!pending || event.seq < runtimeSession.lastSeq) {
        return
      }
      runtimeSession.lastSeq = event.seq
      runtimeSession.pendingBySeq.delete(event.seq)
      void logInvocation(runtimeSession.session.id, pending.toolName, pending.params, event.result, 'success', Date.now() - pending.startedAt)
      pending.resolve(event.result)
      break
    }
    case 'APP_COMPLETE': {
      runtimeSession.session.status = 'complete'
      runtimeSession.session.result = event.result
      setActiveSession({
        sessionId: runtimeSession.session.id,
        appId: runtimeSession.entry.appId,
        conversationId: runtimeSession.session.conversationId,
        messageId: runtimeSession.frameToolCallId,
        status: 'complete',
        stateSummary: runtimeSession.session.stateSummary || undefined,
        result: event.result,
      })
      updateFrameEntry(runtimeSession.frameToolCallId, (entry) => ({
        ...entry,
        status: 'completed',
      }))
      void patchAppSession(runtimeSession.session.id, {
        status: 'complete',
        result: event.result,
        stateSummary: runtimeSession.session.stateSummary || null,
      })
      break
    }
    case 'APP_ERROR':
      updateFrameEntry(runtimeSession.frameToolCallId, (entry) => ({
        ...entry,
        status: 'error',
        error: event.error,
      }))
      break
    default:
      break
  }
}

async function patchAppSession(
  sessionId: string,
  body: { status?: 'active' | 'complete' | 'error'; stateSummary?: string | null; result?: AppResult | null }
) {
  if (isLocalSessionId(sessionId)) {
    return
  }
  await requestJson<{ session: AppSession }>(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  }).catch((error) => {
    console.warn('[plugin-runtime] Failed to patch app session', error)
  })
}

async function logInvocation(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
  result: unknown,
  status: 'success' | 'error' | 'timeout',
  latencyMs: number
) {
  if (isLocalSessionId(sessionId)) {
    return
  }
  await requestJson(`/api/sessions/${sessionId}/invocations`, {
    method: 'POST',
    body: JSON.stringify({
      toolName,
      params,
      result,
      status,
      latencyMs,
    }),
  }).catch((error) => {
    console.warn('[plugin-runtime] Failed to log invocation', error)
  })
}

async function createAppSession(appId: string, conversationId: string) {
  const payload = await requestJson<{ session: AppSession }>(`/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({
      appId,
      conversationId,
    }),
  })
  return AppSessionSchema.parse(payload.session)
}

function createLocalAppSession(appId: string, conversationId: string): AppSession {
  return AppSessionSchema.parse({
    id: `local-app-session-${appId}-${Date.now()}`,
    conversationId,
    userId: null,
    appId,
    status: 'active',
    stateSummary: null,
    result: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
}

async function ensureRuntimeSession(
  appId: string,
  conversationId: string,
  toolCallId: string,
  initConfig?: Record<string, unknown>
) {
  const current = getDefaultStore().get(activeAppSessionAtom)
  if (current?.appId === appId) {
    const existing = runtimeSessions.get(current.sessionId)
    if (existing) {
      if (initConfig) {
        updateFrameEntry(existing.frameToolCallId, (entry) => ({
          ...entry,
          initConfig: {
            ...(entry.initConfig || {}),
            ...getLocalRuntimeConfig(appId),
            ...initConfig,
          },
        }))
      }
      return existing
    }
  }

  const entry = getRegistryCache().find((item) => item.appId === appId)
  if (!entry) {
    throw new Error(`App "${appId}" is not registered`)
  }

  let session: AppSession
  if (supportsLocalRuntime(appId) && !getPluginAuthToken()) {
    session = createLocalAppSession(appId, conversationId)
  } else {
    try {
      session = await createAppSession(appId, conversationId)
    } catch (error) {
      if (supportsLocalRuntime(appId) && error instanceof Error && error.message === 'Plugin backend authentication required') {
        session = createLocalAppSession(appId, conversationId)
      } else {
        throw error
      }
    }
  }
  const frameSource = getLocalAppSource(appId)
  const runtimeSession: RuntimeSession = {
    session,
    entry,
    frameToolCallId: toolCallId,
    nextSeq: 0,
    lastSeq: -1,
    pendingBySeq: new Map(),
  }

  runtimeSession.unregister = registerAppListener(session.id, (event) => handleAppEvent(session.id, event))
  runtimeSessions.set(session.id, runtimeSession)
  setActiveSession({
    sessionId: session.id,
    appId,
    conversationId,
    messageId: toolCallId,
    status: session.status,
    stateSummary: session.stateSummary || undefined,
    result: session.result,
  })
  setFrameEntry(toolCallId, {
    toolCallId,
    appId,
    sessionId: session.id,
    origin: entry.origin,
    ...(frameSource.origin ? { origin: frameSource.origin } : {}),
    src: frameSource.src,
    srcDoc: frameSource.srcDoc,
    status: 'loading',
    initConfig: {
      appId,
      conversationId,
      ...getLocalRuntimeConfig(appId),
      ...(initConfig || {}),
    },
  })

  return runtimeSession
}

function getFrameTimeoutError(toolName: string) {
  return new Error(`Plugin tool "${toolName}" timed out after 15 seconds`)
}

export function registerAppFrame(sessionId: string, iframe: HTMLIFrameElement | null) {
  if (!iframe) {
    iframeElements.delete(sessionId)
    frameReadySessions.delete(sessionId)
    return
  }
  iframeElements.set(sessionId, iframe)
}

export function markAppFrameStatus(sessionId: string, status: PluginFrameEntry['status'], error?: string) {
  const runtimeSession = runtimeSessions.get(sessionId)
  if (!runtimeSession) {
    return
  }
  if (status === 'ready' || status === 'completed') {
    frameReadySessions.add(sessionId)
    const waiters = frameWaiters.get(sessionId)
    if (waiters) {
      for (const waiter of waiters) {
        window.clearTimeout(waiter.timeoutId)
        waiter.resolve()
      }
      frameWaiters.delete(sessionId)
    }
  } else if (status === 'error') {
    frameReadySessions.delete(sessionId)
    const waiters = frameWaiters.get(sessionId)
    if (waiters) {
      const nextError = new Error(error || 'App frame failed to load')
      for (const waiter of waiters) {
        window.clearTimeout(waiter.timeoutId)
        waiter.reject(nextError)
      }
      frameWaiters.delete(sessionId)
    }
  }
  updateFrameEntry(runtimeSession.frameToolCallId, (entry) => ({
    ...entry,
    status,
    error,
  }))
}

function waitForFrameReady(sessionId: string, timeoutMs = 10_000) {
  if (frameReadySessions.has(sessionId)) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      const waiters = frameWaiters.get(sessionId)
      if (!waiters) {
        reject(new Error('App frame was not ready in time'))
        return
      }
      for (const waiter of waiters) {
        if (waiter.timeoutId === timeoutId) {
          waiters.delete(waiter)
          break
        }
      }
      if (waiters.size === 0) {
        frameWaiters.delete(sessionId)
      }
      reject(new Error('App frame was not ready in time'))
    }, timeoutMs)

    const waiters = frameWaiters.get(sessionId) || new Set()
    waiters.add({ resolve, reject, timeoutId })
    frameWaiters.set(sessionId, waiters)
  })
}

export function dismissAppSession(sessionId: string) {
  const runtimeSession = runtimeSessions.get(sessionId)
  if (!runtimeSession) {
    const activeSession = getDefaultStore().get(activeAppSessionAtom)
    if (activeSession?.sessionId === sessionId) {
      setActiveSession(null)
    }
    return
  }

  for (const pending of runtimeSession.pendingBySeq.values()) {
    pending.reject(new Error('App session closed'))
  }
  runtimeSession.pendingBySeq.clear()
  runtimeSession.unregister?.()
  runtimeSessions.delete(sessionId)
  iframeElements.delete(sessionId)
  frameReadySessions.delete(sessionId)
  const waiters = frameWaiters.get(sessionId)
  if (waiters) {
    for (const waiter of waiters) {
      window.clearTimeout(waiter.timeoutId)
      waiter.reject(new Error('App session closed'))
    }
    frameWaiters.delete(sessionId)
  }
  removeFrameEntry(runtimeSession.frameToolCallId)

  const activeSession = getDefaultStore().get(activeAppSessionAtom)
  if (activeSession?.sessionId === sessionId) {
    setActiveSession(null)
  }
}

export async function invokePluginTool(
  toolName: string,
  params: Record<string, unknown>,
  options: { conversationId: string; appId: string; toolCallId: string }
) {
  const runtimeSession =
    toolName === 'chess_start'
      ? await ensureRuntimeSession(options.appId, options.conversationId, options.toolCallId)
      : toolName === 'weather_get'
        ? await ensureRuntimeSession(options.appId, options.conversationId, options.toolCallId)
        : getRuntimeSessionByTool(toolName)

  if (!runtimeSession) {
    throw new Error(`No active plugin session found for tool "${toolName}"`)
  }

  if (toolName === 'chess_start') {
    const result = {
      sessionId: runtimeSession.session.id,
      accepted: true,
      stateSummary: runtimeSession.session.stateSummary || 'Chess board initialized.',
    }
    void logInvocation(runtimeSession.session.id, toolName, params, result, 'success', 0)
    return result
  }

  await waitForFrameReady(runtimeSession.session.id)

  const iframe = getFrameForSession(runtimeSession.session.id)
  if (!iframe) {
    throw new Error('Plugin app frame is not ready')
  }

  const seq = ++runtimeSession.nextSeq

  return await new Promise<unknown>((resolve, reject) => {
    const pending: PendingInvocation = {
      toolCallId: options.toolCallId,
      seq,
      toolName,
      params,
      startedAt: Date.now(),
      resolve,
      reject,
    }

    runtimeSession.pendingBySeq.set(seq, pending)

    const timeout = window.setTimeout(() => {
      runtimeSession.pendingBySeq.delete(seq)
      void logInvocation(runtimeSession.session.id, toolName, params, { error: 'timeout' }, 'timeout', Date.now() - pending.startedAt)
      try {
        sendToApp(iframe, {
          type: 'APP_ERROR',
          sessionId: runtimeSession.session.id,
          error: 'Invocation timed out',
        })
      } catch {}
      reject(getFrameTimeoutError(toolName))
    }, INVOCATION_TIMEOUT_MS)

    pending.resolve = (value) => {
      window.clearTimeout(timeout)
      resolve(value)
    }
    pending.reject = (error) => {
      window.clearTimeout(timeout)
      reject(error)
    }

    try {
      sendToApp(iframe, {
        type: 'INVOKE_TOOL',
        sessionId: runtimeSession.session.id,
        seq,
        toolName,
        params,
      })
    } catch (error) {
      window.clearTimeout(timeout)
      runtimeSession.pendingBySeq.delete(seq)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

export function getPluginTools(conversationId?: string): ToolSet {
  const entries = getRegistryCache()
  const tools: ToolSet = {}

  for (const entry of entries) {
    for (const definition of entry.manifest.tools) {
      tools[definition.name] = createPluginTool(definition, entry, conversationId)
    }
  }

  return tools
}

export function injectActiveAppSummary(messages: import('@shared/types').Message[]) {
  const activeSession = getDefaultStore().get(activeAppSessionAtom)
  if (!activeSession?.stateSummary) {
    return messages
  }

  const runtimeSession = runtimeSessions.get(activeSession.sessionId)
  if (!runtimeSession) {
    return messages
  }

  const summary = ensureSummaryWithinLimit(buildSummaryText(runtimeSession))

  return [
    {
      id: `plugin-app-summary-${activeSession.sessionId}`,
      role: 'system',
      contentParts: [{ type: 'text', text: summary }],
      timestamp: Date.now(),
    },
    ...messages,
  ]
}
