import { describe, expect, test } from 'vitest'
import {
  AppManifestSchema,
  AppToPlatformEventSchema,
  PlatformToAppEventSchema,
  ToolDefinitionSchema,
  parseAppToPlatformEvent,
  parseManifest,
} from './types'

describe('plugin contract validation', () => {
  test('accepts a valid manifest', () => {
    const manifest = parseManifest({
      id: 'chess-v1',
      name: 'Chess',
      version: '1.0.0',
      origin: 'https://apps.chatbridge.app',
      requiresAuth: false,
      tools: [
        {
          name: 'chess_start',
          description: 'Start a new chess game',
          parameters: { type: 'object', properties: {} },
          returns: { type: 'object', properties: { sessionId: { type: 'string' } } },
        },
      ],
    })

    expect(manifest.id).toBe('chess-v1')
    expect(manifest.tools).toHaveLength(1)
  })

  test('rejects a manifest with a missing required field', () => {
    const result = AppManifestSchema.safeParse({
      name: 'Chess',
      version: '1.0.0',
      origin: 'https://apps.chatbridge.app',
      requiresAuth: false,
      tools: [],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'id')).toBe(true)
  })

  test('rejects a tool definition with a missing description', () => {
    const result = ToolDefinitionSchema.safeParse({
      name: 'chess_move',
      parameters: { type: 'object' },
      returns: { type: 'object' },
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'description')).toBe(true)
  })

  test('rejects an auth manifest without authProvider', () => {
    const result = AppManifestSchema.safeParse({
      id: 'spotify-v1',
      name: 'Spotify',
      version: '1.0.0',
      origin: 'https://apps.chatbridge.app',
      requiresAuth: true,
      tools: [
        {
          name: 'spotify_create_playlist',
          description: 'Create a playlist',
          parameters: { type: 'object' },
          returns: { type: 'object' },
        },
      ],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'authProvider')).toBe(true)
  })

  test('parses a valid app-to-platform completion event', () => {
    const event = parseAppToPlatformEvent({
      type: 'APP_COMPLETE',
      sessionId: 'session-123',
      result: {
        summary: 'White won in 32 moves.',
        data: { winner: 'white', moveCount: 32 },
      },
    })

    expect(event.type).toBe('APP_COMPLETE')
    expect(event.result.summary).toContain('White won')
  })

  test('rejects malformed app-to-platform events', () => {
    const result = AppToPlatformEventSchema.safeParse({
      type: 'APP_RESULT',
      sessionId: 'session-123',
      toolName: 'chess_move',
      result: {},
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.path[0] === 'seq')).toBe(true)
  })

  test('rejects malformed platform-to-app invoke events', () => {
    const result = PlatformToAppEventSchema.safeParse({
      type: 'INVOKE_TOOL',
      sessionId: '',
      seq: -1,
      toolName: '',
      params: {},
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues.length).toBeGreaterThan(0)
  })
})
