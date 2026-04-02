import type { AppResult, PluginRegistryEntry } from './types'

export type PluginBackendStatus = 'idle' | 'loading' | 'ready' | 'unauthorized' | 'unavailable'

export interface PluginBackendState {
  status: PluginBackendStatus
  error?: string
  loadedAt?: number
}

export interface ActiveAppSessionRef {
  sessionId: string
  appId: string
  conversationId: string
  messageId: string
  status: 'active' | 'complete' | 'error'
  stateSummary?: string
  result?: AppResult | null
}

export type PluginFrameStatus = 'loading' | 'ready' | 'error' | 'completed'

export interface PluginFrameEntry {
  toolCallId: string
  appId: string
  sessionId: string
  origin: string
  src: string
  srcDoc?: string
  status: PluginFrameStatus
  initConfig?: Record<string, unknown>
  error?: string
}

export type PluginRegistryState = PluginRegistryEntry[]
