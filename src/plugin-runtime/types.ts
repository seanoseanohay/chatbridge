import { z } from 'zod'

const JsonRecordSchema = z.record(z.string(), z.unknown())

export const JsonSchemaObjectSchema = JsonRecordSchema

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: JsonSchemaObjectSchema,
  returns: JsonSchemaObjectSchema,
})

export const AppManifestSchema = z
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
        message: 'authProvider is required when requiresAuth is true',
        path: ['authProvider'],
      })
    }
  })

export const AppResultSchema = z.object({
  summary: z.string().min(1),
  data: JsonRecordSchema,
})

export const PlatformToAppEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INIT_APP'),
    sessionId: z.string().min(1),
    config: JsonRecordSchema,
  }),
  z.object({
    type: z.literal('INVOKE_TOOL'),
    sessionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    toolName: z.string().min(1),
    params: JsonRecordSchema,
  }),
  z.object({
    type: z.literal('APP_ERROR'),
    sessionId: z.string().min(1),
    error: z.string().min(1),
  }),
])

export const AppToPlatformEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('APP_READY'),
    sessionId: z.string().min(1),
  }),
  z.object({
    type: z.literal('APP_STATE_UPDATE'),
    sessionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    stateSummary: z.string().min(1),
  }),
  z.object({
    type: z.literal('APP_RESULT'),
    sessionId: z.string().min(1),
    seq: z.number().int().nonnegative(),
    toolName: z.string().min(1),
    result: z.unknown(),
  }),
  z.object({
    type: z.literal('APP_COMPLETE'),
    sessionId: z.string().min(1),
    result: AppResultSchema,
  }),
  z.object({
    type: z.literal('APP_ERROR'),
    sessionId: z.string().min(1),
    error: z.string().min(1),
  }),
])

export const AppSessionStatusSchema = z.enum(['active', 'complete', 'error'])

export const AppSessionSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  userId: z.string().min(1).nullable().optional(),
  appId: z.string().min(1),
  status: AppSessionStatusSchema,
  stateSummary: z.string().nullable().optional(),
  result: AppResultSchema.nullable().optional(),
  createdAt: z.string().min(1).optional(),
  updatedAt: z.string().min(1).optional(),
})

export const PluginRegistryEntrySchema = z.object({
  appId: z.string().min(1),
  manifest: AppManifestSchema,
  origin: z.string().url(),
  enabled: z.boolean(),
})

export type JsonSchemaObject = z.infer<typeof JsonSchemaObjectSchema>
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>
export type AppManifest = z.infer<typeof AppManifestSchema>
export type AppResult = z.infer<typeof AppResultSchema>
export type PlatformToAppEvent = z.infer<typeof PlatformToAppEventSchema>
export type AppToPlatformEvent = z.infer<typeof AppToPlatformEventSchema>
export type AppSessionStatus = z.infer<typeof AppSessionStatusSchema>
export type AppSession = z.infer<typeof AppSessionSchema>
export type PluginRegistryEntry = z.infer<typeof PluginRegistryEntrySchema>

export function parseManifest(input: unknown): AppManifest {
  return AppManifestSchema.parse(input)
}

export function parseToolDefinition(input: unknown): ToolDefinition {
  return ToolDefinitionSchema.parse(input)
}

export function parsePlatformToAppEvent(input: unknown): PlatformToAppEvent {
  return PlatformToAppEventSchema.parse(input)
}

export function parseAppToPlatformEvent(input: unknown): AppToPlatformEvent {
  return AppToPlatformEventSchema.parse(input)
}

