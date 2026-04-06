import { z } from 'zod'

type ToolDefinition = {
  name: string
  description: string
  parameters: Record<string, unknown>
  returns: Record<string, unknown>
}

type AppManifest = {
  id: string
  name: string
  version: string
  origin: string
  tools: ToolDefinition[]
  requiresAuth: boolean
  authProvider?: string
}

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
          additionalProperties: true,
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
  {
    id: 'weather-v1',
    name: 'Weather',
    version: '1.0.0',
    origin: 'https://apps.chatbridge.app/weather',
    requiresAuth: false,
    tools: [
      {
        name: 'weather_get',
        description: 'Show the current weather and a 5-day forecast for a city.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string' },
          },
          required: ['location'],
          additionalProperties: false,
        },
        returns: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            temperatureF: { type: 'number' },
            description: { type: 'string' },
          },
          required: ['location', 'temperatureF', 'description'],
          additionalProperties: true,
        },
      },
    ],
  },
  {
    id: 'github-v1',
    name: 'GitHub',
    version: '1.0.0',
    origin: 'https://apps.chatbridge.app/github',
    requiresAuth: true,
    authProvider: 'github',
    tools: [
      {
        name: 'github_open',
        description: 'Open the GitHub app in the ChatBridge app panel.',
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
    ],
  },
  {
    id: 'slack-v1',
    name: 'Slack',
    version: '1.0.0',
    origin: 'https://apps.chatbridge.app/slack',
    requiresAuth: true,
    authProvider: 'slack',
    tools: [
      {
        name: 'slack_open',
        description: 'Open Slack and summarize your workspace activity.',
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
