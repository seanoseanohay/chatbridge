import { afterEach, describe, expect, it, vi } from 'vitest'
import * as auth from './auth'
import { __resetRegistryForTests, fetchRegistry, getAppManifest, resolveToolToApp } from './registry'

const samplePayload = {
  apps: [
    {
      appId: 'chess-v1',
      origin: 'https://apps.chatbridge.app',
      enabled: true,
      manifest: {
        id: 'chess-v1',
        name: 'Chess',
        version: '1.0.0',
        origin: 'https://apps.chatbridge.app',
        requiresAuth: false,
        tools: [
          {
            name: 'chess_start',
            description: 'Start a chess game.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
            returns: { type: 'object', properties: {}, additionalProperties: false },
          },
        ],
      },
    },
  ],
}

describe('plugin registry', () => {
  afterEach(() => {
    __resetRegistryForTests()
    vi.restoreAllMocks()
  })

  it('uses the built-in registry without calling the backend when no auth token exists', async () => {
    vi.spyOn(auth, 'initializePluginAuth').mockResolvedValue(null)
    vi.spyOn(auth, 'getPluginAuthToken').mockReturnValue(null)
    const fetchMock = vi.fn<typeof fetch>()

    const result = await fetchRegistry(fetchMock)

    expect(result.status).toBe('unauthorized')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(resolveToolToApp('chess_start')?.appId).toBe('chess-v1')
    expect(resolveToolToApp('weather_get')?.appId).toBe('weather-v1')
    expect(resolveToolToApp('github_open')?.appId).toBe('github-v1')
  })

  it('loads and indexes manifests from the backend response', async () => {
    vi.spyOn(auth, 'initializePluginAuth').mockResolvedValue('token')
    vi.spyOn(auth, 'getPluginAuthToken').mockReturnValue('token')
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => samplePayload,
    } as Response)

    const result = await fetchRegistry(fetchMock)

    expect(result.status).toBe('ready')
    expect(result.apps).toHaveLength(1)
    expect(resolveToolToApp('chess_start')?.appId).toBe('chess-v1')
    expect(getAppManifest('chess-v1')?.name).toBe('Chess')
  })

  it('keeps the built-in chess app available on unauthorized responses', async () => {
    vi.spyOn(auth, 'initializePluginAuth').mockResolvedValue('token')
    vi.spyOn(auth, 'getPluginAuthToken').mockReturnValue('token')
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response)

    const result = await fetchRegistry(fetchMock)

    expect(result.status).toBe('unauthorized')
    expect(resolveToolToApp('chess_start')?.appId).toBe('chess-v1')
    expect(getAppManifest('chess-v1')?.name).toBe('Chess')
    expect(resolveToolToApp('weather_get')?.appId).toBe('weather-v1')
    expect(getAppManifest('weather-v1')?.name).toBe('Weather')
    expect(resolveToolToApp('github_open')?.appId).toBe('github-v1')
    expect(getAppManifest('github-v1')?.name).toBe('GitHub')
  })

  it('keeps built-in apps available when the backend is unreachable', async () => {
    vi.spyOn(auth, 'initializePluginAuth').mockResolvedValue('token')
    vi.spyOn(auth, 'getPluginAuthToken').mockReturnValue('token')
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('connect ECONNREFUSED'))

    const result = await fetchRegistry(fetchMock)

    expect(result.status).toBe('ready')
    expect(result.error).toContain('ECONNREFUSED')
    expect(result.apps.length).toBeGreaterThan(0)
    expect(resolveToolToApp('chess_start')?.appId).toBe('chess-v1')
    expect(resolveToolToApp('weather_get')?.appId).toBe('weather-v1')
    expect(resolveToolToApp('github_open')?.appId).toBe('github-v1')
  })
})
