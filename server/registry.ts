import { z } from 'zod'
import type { AppManifest } from '../src/plugin-runtime/types.ts'

const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()),
  returns: z.record(z.string(), z.unknown()),
})

const AppManifestSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    origin: z.string().url(),
    tools: z.array(ToolDefinitionSchema).min(1),
    requiresAuth: z.boolean(),
    authProvider: z.string().min(1).optional(),
  })
  .superRefine((manifest, ctx) => {
    if (manifest.requiresAuth && !manifest.authProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['authProvider'],
        message: 'authProvider is required when requiresAuth is true',
      })
    }
  })

const registryManifests = [
  {
    id: 'chess-v1',
    name: 'Chess',
    version: '1.0.0',
    origin: 'https://apps.chatbridge.app/chess',
    requiresAuth: false,
    tools: [
      {
        name: 'chess_start',
        description: 'Start a new chess game inside the ChatBridge app frame.',
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        returns: {
          type: 'object',
          properties: {
            sessionId: { type: 'string' },
          },
          required: ['sessionId'],
          additionalProperties: false,
        },
      },
      {
        name: 'chess_move',
        description: 'Make a chess move in algebraic notation.',
        parameters: {
          type: 'object',
          properties: {
            move: { type: 'string' },
          },
          required: ['move'],
          additionalProperties: false,
        },
        returns: {
          type: 'object',
          properties: {
            accepted: { type: 'boolean' },
          },
          required: ['accepted'],
          additionalProperties: false,
        },
      },
    ],
  },
] satisfies AppManifest[]

const registry = registryManifests.map((manifest) => {
  const parsedManifest = AppManifestSchema.parse(manifest)
  return {
    appId: parsedManifest.id,
    manifest: parsedManifest,
    origin: parsedManifest.origin,
    enabled: true,
  }
})

export function listRegistryEntries() {
  return registry.filter((entry) => entry.enabled)
}

export function getRegistryEntry(appId: string) {
  return registry.find((entry) => entry.appId === appId)
}
