import { PluginRegistryEntrySchema, type AppManifest, type PluginRegistryEntry } from './types'
import { getPluginAuthToken } from './auth'

const DEFAULT_PLUGIN_BACKEND_URL = 'http://localhost:3001'

type RegistryLoadStatus = 'ready' | 'unauthorized' | 'unavailable'

export interface RegistryLoadResult {
  apps: PluginRegistryEntry[]
  status: RegistryLoadStatus
  error?: string
}

let registryCache: PluginRegistryEntry[] = []
let registryByAppId = new Map<string, PluginRegistryEntry>()
let toolToAppId = new Map<string, string>()

function rebuildIndexes(apps: PluginRegistryEntry[]) {
  registryCache = apps
  registryByAppId = new Map(apps.map((entry) => [entry.appId, entry]))
  toolToAppId = new Map(
    apps.flatMap((entry) => entry.manifest.tools.map((tool) => [tool.name, entry.appId] as const))
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
  rebuildIndexes([])
}
