import { PluginRegistryEntrySchema, type AppManifest, type PluginRegistryEntry } from './types'
import { getPluginAuthToken } from './auth'

const DEFAULT_PLUGIN_BACKEND_URL = 'http://localhost:4302'

const BUILTIN_CHESS_ENTRY: PluginRegistryEntry = PluginRegistryEntrySchema.parse({
  appId: 'chess-v1',
  origin: 'https://apps.chatbridge.app/chess',
  enabled: true,
  manifest: {
    id: 'chess-v1',
    name: 'Chess',
    version: '1.0.0',
    origin: 'https://apps.chatbridge.app/chess',
    requiresAuth: false,
    tools: [
      {
        name: 'chess_start',
        description: 'Start a new chess game inside the ChatBridge app frame.',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        returns: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'], additionalProperties: false },
      },
      {
        name: 'chess_move',
        description: 'Make a chess move in algebraic notation.',
        parameters: {
          type: 'object',
          properties: { move: { type: 'string' } },
          required: ['move'],
          additionalProperties: false,
        },
        returns: { type: 'object', properties: { accepted: { type: 'boolean' } }, required: ['accepted'], additionalProperties: false },
      },
    ],
  },
})

type RegistryLoadStatus = 'ready' | 'unauthorized' | 'unavailable'

export interface RegistryLoadResult {
  apps: PluginRegistryEntry[]
  status: RegistryLoadStatus
  error?: string
}

let registryCache: PluginRegistryEntry[] = []
let registryByAppId = new Map<string, PluginRegistryEntry>()
let toolToAppId = new Map<string, string>()

function mergeBuiltinApps(apps: PluginRegistryEntry[]) {
  const merged = new Map<string, PluginRegistryEntry>([[BUILTIN_CHESS_ENTRY.appId, BUILTIN_CHESS_ENTRY]])
  for (const entry of apps) {
    merged.set(entry.appId, entry)
  }
  return Array.from(merged.values())
}

function rebuildIndexes(apps: PluginRegistryEntry[]) {
  const mergedApps = mergeBuiltinApps(apps)
  registryCache = mergedApps
  registryByAppId = new Map(mergedApps.map((entry) => [entry.appId, entry]))
  toolToAppId = new Map(
    mergedApps.flatMap((entry) => entry.manifest.tools.map((tool) => [tool.name, entry.appId] as const))
  )
}

export function getPluginBackendUrl(): string {
  return process.env.PLUGIN_BACKEND_URL || DEFAULT_PLUGIN_BACKEND_URL
}

export function getRegistryCache(): PluginRegistryEntry[] {
  return registryCache
}

export async function fetchRegistry(fetchImpl: typeof fetch = fetch): Promise<RegistryLoadResult> {
  try {
    const response = await fetchImpl(`${getPluginBackendUrl()}/api/apps`, {
      headers: {
        Accept: 'application/json',
        ...(getPluginAuthToken() ? { Authorization: `Bearer ${getPluginAuthToken()}` } : {}),
      },
    })

    if (response.status === 401) {
      rebuildIndexes([])
      return {
        apps: [],
        status: 'unauthorized',
        error: 'Plugin backend requires authentication',
      }
    }

    if (!response.ok) {
      throw new Error(`Registry fetch failed with status ${response.status}`)
    }

    const payload = (await response.json()) as { apps?: unknown[] }
    const apps = (payload.apps || []).map((entry) => PluginRegistryEntrySchema.parse(entry))
    rebuildIndexes(apps)

    return {
      apps,
      status: 'ready',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    rebuildIndexes([])
    console.warn('[plugin-runtime] Failed to load app registry', error)
    return {
      apps: [],
      status: 'unavailable',
      error: message,
    }
  }
}

export async function loadRegistry(fetchImpl: typeof fetch = fetch): Promise<PluginRegistryEntry[]> {
  const result = await fetchRegistry(fetchImpl)
  return result.apps
}

export function resolveToolToApp(toolName: string): PluginRegistryEntry | null {
  const appId = toolToAppId.get(toolName)
  return appId ? registryByAppId.get(appId) || null : null
}

export function getAppManifest(appId: string): AppManifest | null {
  return registryByAppId.get(appId)?.manifest || null
}

export function __resetRegistryForTests() {
  registryCache = []
  registryByAppId = new Map()
  toolToAppId = new Map()
}
