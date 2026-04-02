import { Router } from 'express'
import { z } from 'zod'
import { query } from '../db/client'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { validateBody } from '../middleware/validate'

const InvocationBodySchema = z.object({
  toolName: z.string().min(1),
  params: z.record(z.string(), z.unknown()),
  result: z.unknown(),
  status: z.string().min(1),
  latencyMs: z.number().int().nonnegative(),
})

interface InvocationRow {
  id: string
  session_id: string
  tool_name: string
  params: unknown
  result: unknown
  status: string
  latency_ms: number
  created_at: string
}

export const invocationsRouter = Router({ mergeParams: true })

invocationsRouter.use(requireAuth)

invocationsRouter.post(
  '/',
  validateBody(InvocationBodySchema),
  async (request: AuthenticatedRequest, response, next) => {
    try {
      const sessionResult = await query<{ id: string; user_id: string | null }>(
        `
          select id, user_id
          from app_sessions
          where id = $1
          limit 1
        `,
        [request.params.id]
      )
      const session = sessionResult.rows[0]
      if (!session) {
        response.status(404).json({ error: 'Session not found' })
        return
      }
      if (session.user_id && session.user_id !== request.auth?.userId) {
        response.status(403).json({ error: 'Forbidden' })
        return
      }

      const body = request.body as z.infer<typeof InvocationBodySchema>
      const result = await query<InvocationRow>(
        `
          insert into tool_invocations (session_id, tool_name, params, result, status, latency_ms)
          values ($1, $2, $3, $4, $5, $6)
          returning id, session_id, tool_name, params, result, status, latency_ms, created_at
        `,
        [request.params.id, body.toolName, body.params, body.result, body.status, body.latencyMs]
      )

      response.status(201).json({
        invocation: {
          id: result.rows[0].id,
          sessionId: result.rows[0].session_id,
          toolName: result.rows[0].tool_name,
          params: result.rows[0].params,
          result: result.rows[0].result,
          status: result.rows[0].status,
          latencyMs: result.rows[0].latency_ms,
          createdAt: result.rows[0].created_at,
        },
      })
    } catch (error) {
      next(error)
    }
  }
)
