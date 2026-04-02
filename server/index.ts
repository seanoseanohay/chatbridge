import express from 'express'
import { pgPool } from './db/client'
import { getRedisClient } from './cache/client'
import { authRouter } from './routes/auth'
import { appsRouter } from './routes/apps'
import { sessionsRouter } from './routes/sessions'
import { invocationsRouter } from './routes/invocations'
import { oauthRouter } from './routes/oauth'
import { env } from './config'

export function createServerApp() {
  const app = express()

  app.use((request, response, next) => {
    response.header('Access-Control-Allow-Origin', request.headers.origin || '*')
    response.header('Vary', 'Origin')
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS')

    if (request.method === 'OPTIONS') {
      response.sendStatus(204)
      return
    }

    next()
  })

  app.use(express.json())

  app.get('/healthz', async (_request, response) => {
    await pgPool.query('select 1')
    response.json({ ok: true })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/apps', appsRouter)
  app.use('/api/sessions', sessionsRouter)
  app.use('/api/sessions/:id/invocations', invocationsRouter)
  app.use('/api/oauth', oauthRouter)

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('server:error', error)
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  })

  return app
}

async function bootstrap() {
  await pgPool.query('select 1')
  await getRedisClient()
  const app = createServerApp()
  app.listen(env.PORT, () => {
    console.log(`chatbridge-server listening on :${env.PORT}`)
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((error) => {
    console.error('server:bootstrap:error', error)
    process.exit(1)
  })
}
