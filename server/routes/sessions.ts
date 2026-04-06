import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/client'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { getRegistryEntry } from '../registry'

const CreateSessionBodySchema = z.object({
  appId: z.string().min(1),
  conversationId: z.string().min(1),
})

const LatestSessionQuerySchema = z.object({
  appId: z.string().min(1),
  conversationId: z.string().min(1),
  status: z.enum(['active', 'complete', 'error']).optional(),
})

const UpdateSessionBodySchema = z.object({
  status: z.enum(['active', 'complete', 'error']).optional(),
  stateSummary: z.string().nullable().optional(),
  result: z.record(z.string(), z.unknown()).nullable().optional(),
})

interface AppSessionRow {
  id: string
  conversation_id: string
  user_id: string | null
  app_id: string
  status: 'active' | 'complete' | 'error'
  state_summary: string | null
  result: unknown
  created_at: string
  updated_at: string
}

function mapSession(row: AppSessionRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    appId: row.app_id,
    status: row.status,
    stateSummary: row.state_summary,
    result: row.result,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const sessionsRouter = Router()

sessionsRouter.use(requireAuth)

sessionsRouter.get('/latest', async (request: AuthenticatedRequest, response, next) => {
  try {
    const queryParse = LatestSessionQuerySchema.safeParse(request.query)
    if (!queryParse.success) {
      response.status(400).json({ error: 'Invalid query parameters' })
      return
    }

    const { appId, conversationId, status } = queryParse.data
    const result = await query<AppSessionRow>(
      `
        select id, conversation_id, user_id, app_id, status, state_summary, result, created_at, updated_at
        from app_sessions
        where conversation_id = $1
          and app_id = $2
          and ($3::text is null or status = $3)
          and ($4::uuid is null or user_id = $4)
        order by updated_at desc
        limit 1
      `,
      [conversationId, appId, status ?? null, request.auth?.userId ?? null]
    )

    const session = result.rows[0]
    response.json({
      session: session ? mapSession(session) : null,
    })
  } catch (error) {
    next(error)
  }
})

sessionsRouter.post('/', validateBody(CreateSessionBodySchema), async (request: AuthenticatedRequest, response, next) => {
  try {
    const { appId, conversationId } = request.body as z.infer<typeof CreateSessionBodySchema>
    if (!getRegistryEntry(appId)) {
      response.status(404).json({ error: 'App not found' })
      return
    }

    const result = await query<AppSessionRow>(
      `
        insert into app_sessions (conversation_id, user_id, app_id)
        values ($1, $2, $3)
        returning id, conversation_id, user_id, app_id, status, state_summary, result, created_at, updated_at
      `,
      [conversationId, request.auth?.userId ?? null, appId]
    )

    response.status(201).json({ session: mapSession(result.rows[0]) })
  } catch (error) {
    next(error)
  }
})

sessionsRouter.get('/:id', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await query<AppSessionRow>(
      `
        select id, conversation_id, user_id, app_id, status, state_summary, result, created_at, updated_at
        from app_sessions
        where id = $1
        limit 1
      `,
      [request.params.id]
    )
    const session = result.rows[0]
    if (!session) {
      response.status(404).json({ error: 'Session not found' })
      return
    }
    if (session.user_id && session.user_id !== request.auth?.userId) {
      response.status(403).json({ error: 'Forbidden' })
      return
    }

    response.json({ session: mapSession(session) })
  } catch (error) {
    next(error)
  }
})

sessionsRouter.patch('/:id', validateBody(UpdateSessionBodySchema), async (request: AuthenticatedRequest, response, next) => {
  try {
    const sessionResult = await query<AppSessionRow>(
      `
        select id, conversation_id, user_id, app_id, status, state_summary, result, created_at, updated_at
        from app_sessions
        where id = $1
        limit 1
      `,
      [request.params.id]
    )
    const existing = sessionResult.rows[0]
    if (!existing) {
      response.status(404).json({ error: 'Session not found' })
      return
    }
    if (existing.user_id && existing.user_id !== request.auth?.userId) {
      response.status(403).json({ error: 'Forbidden' })
      return
    }

    const body = request.body as z.infer<typeof UpdateSessionBodySchema>
    const result = await query<AppSessionRow>(
      `
        update app_sessions
        set status = coalesce($2, status),
            state_summary = case when $3::text is null then state_summary else $3 end,
            result = case when $4::jsonb is null then result else $4 end,
            updated_at = now()
        where id = $1
        returning id, conversation_id, user_id, app_id, status, state_summary, result, created_at, updated_at
      `,
      [request.params.id, body.status ?? null, body.stateSummary ?? null, body.result ?? null]
    )

    response.json({ session: mapSession(result.rows[0]) })
  } catch (error) {
    next(error)
  }
})
