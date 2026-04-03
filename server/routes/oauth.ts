import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getRedisClient } from '../cache/client'
import { env } from '../config'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { disconnectSpotify, exchangeSpotifyAuthorizationCode, getStoredSpotifyToken, refreshSpotifyAccessToken, upsertSpotifyToken } from '../spotify'

const CONNECT_QUERY_SCHEMA = z.object({
  sessionId: z.string().min(1).optional(),
})

const CALLBACK_QUERY_SCHEMA = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
})

const OAUTH_REDIS_KEY_PREFIX = 'chatbridge:spotify:oauth'
const SPOTIFY_SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'user-read-private'].join(' ')

function oauthRedisKey(state: string) {
  return `${OAUTH_REDIS_KEY_PREFIX}:${state}`
}

function renderOAuthCallbackHtml(payload: { ok: boolean; state?: string; error?: string }) {
  const serialized = JSON.stringify({
    type: 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE',
    ...payload,
  })

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ChatBridge Spotify Login</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #132238; }
    </style>
  </head>
  <body>
    <h1>${payload.ok ? 'Spotify connected' : 'Spotify connection failed'}</h1>
    <p>${payload.ok ? 'You can return to ChatBridge now.' : payload.error || 'Unknown OAuth error.'}</p>
    <script>
      const message = ${serialized};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, '*');
        }
      } catch {}
      window.close();
    </script>
  </body>
</html>`
}

export const oauthRouter = Router()

oauthRouter.get('/spotify/status', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const token = await getStoredSpotifyToken(request.auth!.userId)
    response.json({
      connected: Boolean(token),
      expiresAt: token?.expires_at || null,
    })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/spotify/connect', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
      response.status(503).json({ error: 'Spotify OAuth is not configured.' })
      return
    }

    const { sessionId } = CONNECT_QUERY_SCHEMA.parse(request.query)
    const state = crypto.randomUUID()
    const redis = await getRedisClient()
    await redis.setEx(
      oauthRedisKey(state),
      600,
      JSON.stringify({
        userId: request.auth!.userId,
        sessionId: sessionId || null,
      })
    )

    const authorizeUrl = new URL('https://accounts.spotify.com/authorize')
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('client_id', env.SPOTIFY_CLIENT_ID)
    authorizeUrl.searchParams.set('scope', SPOTIFY_SCOPES)
    authorizeUrl.searchParams.set('redirect_uri', env.SPOTIFY_REDIRECT_URI)
    authorizeUrl.searchParams.set('state', state)

    response.json({ authorizeUrl: authorizeUrl.toString(), state })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/spotify/callback', async (request, response, next) => {
  try {
    const { code, state, error } = CALLBACK_QUERY_SCHEMA.parse(request.query)

    if (error || !code || !state) {
      response.status(400).type('html').send(
        renderOAuthCallbackHtml({
          ok: false,
          state,
          error: error || 'Missing OAuth code or state',
        })
      )
      return
    }

    const redis = await getRedisClient()
    const rawState = await redis.get(oauthRedisKey(state))
    await redis.del(oauthRedisKey(state))

    if (!rawState) {
      response.status(400).type('html').send(renderOAuthCallbackHtml({ ok: false, state, error: 'OAuth state expired' }))
      return
    }

    const parsedState = z
      .object({
        userId: z.string().min(1),
        sessionId: z.string().nullable(),
      })
      .parse(JSON.parse(rawState))

    const tokenResponse = await exchangeSpotifyAuthorizationCode(code)
    await upsertSpotifyToken(parsedState.userId, {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresInSeconds: tokenResponse.expires_in,
    })

    response.type('html').send(renderOAuthCallbackHtml({ ok: true, state }))
  } catch (error) {
    next(error)
  }
})

oauthRouter.post('/spotify/refresh', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const stored = await getStoredSpotifyToken(request.auth!.userId)
    if (!stored) {
      response.status(404).json({ error: 'Spotify account is not connected' })
      return
    }

    const refreshed = await refreshSpotifyAccessToken(stored.refresh_token)
    await upsertSpotifyToken(request.auth!.userId, {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || stored.refresh_token,
      expiresInSeconds: refreshed.expires_in,
    })

    response.json({ connected: true })
  } catch (error) {
    next(error)
  }
})

oauthRouter.delete('/spotify', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    await disconnectSpotify(request.auth!.userId)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
