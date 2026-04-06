import crypto from 'node:crypto'
import { Router } from 'express'
import { z } from 'zod'
import { getRedisClient } from '../cache/client'
import { env } from '../config'
import { disconnectGitHub, exchangeGitHubAuthorizationCode, getStoredGitHubToken, upsertGitHubToken } from '../github'
import { disconnectSlack, exchangeSlackAuthorizationCode, getStoredSlackToken, upsertSlackToken } from '../slack'
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

const GITHUB_OAUTH_REDIS_KEY_PREFIX = 'chatbridge:github:oauth'
const GITHUB_SCOPES = ['read:user', 'repo'].join(' ')
const OAUTH_REDIS_KEY_PREFIX = 'chatbridge:spotify:oauth'
const SPOTIFY_SCOPES = ['playlist-modify-private', 'playlist-modify-public', 'user-read-private'].join(' ')
const SLACK_OAUTH_REDIS_KEY_PREFIX = 'chatbridge:slack:oauth'
const SLACK_SCOPES = ['channels:read', 'channels:history', 'groups:read', 'groups:history'].join(',')

function oauthRedisKey(state: string) {
  return `${OAUTH_REDIS_KEY_PREFIX}:${state}`
}

function githubOAuthRedisKey(state: string) {
  return `${GITHUB_OAUTH_REDIS_KEY_PREFIX}:${state}`
}

function slackOAuthRedisKey(state: string) {
  return `${SLACK_OAUTH_REDIS_KEY_PREFIX}:${state}`
}

function renderOAuthCallbackHtml(
  provider: 'Spotify' | 'GitHub' | 'Slack',
  messageType: 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE' | 'CHATBRIDGE_GITHUB_OAUTH_COMPLETE' | 'CHATBRIDGE_SLACK_OAUTH_COMPLETE',
  payload: { ok: boolean; state?: string; error?: string }
) {
  const serialized = JSON.stringify({
    type: messageType,
    ...payload,
  })

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>ChatBridge ${provider} Login</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #132238; }
    </style>
  </head>
  <body>
    <h1>${payload.ok ? `${provider} connected` : `${provider} connection failed`}</h1>
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

oauthRouter.get('/github/status', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const token = await getStoredGitHubToken(request.auth!.userId)
    response.json({
      connected: Boolean(token),
      expiresAt: token?.expires_at || null,
    })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/github/connect', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      response.status(503).json({ error: 'GitHub OAuth is not configured.' })
      return
    }

    const { sessionId } = CONNECT_QUERY_SCHEMA.parse(request.query)
    const state = crypto.randomUUID()
    const redis = await getRedisClient()
    await redis.setEx(
      githubOAuthRedisKey(state),
      600,
      JSON.stringify({
        userId: request.auth!.userId,
        sessionId: sessionId || null,
      })
    )

    const authorizeUrl = new URL('https://github.com/login/oauth/authorize')
    authorizeUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
    authorizeUrl.searchParams.set('scope', GITHUB_SCOPES)
    authorizeUrl.searchParams.set('redirect_uri', env.GITHUB_REDIRECT_URI)
    authorizeUrl.searchParams.set('state', state)

    response.json({ authorizeUrl: authorizeUrl.toString(), state })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/github/callback', async (request, response, next) => {
  try {
    const { code, state, error } = CALLBACK_QUERY_SCHEMA.parse(request.query)

    if (error || !code || !state) {
      response.status(400).type('html').send(
        renderOAuthCallbackHtml('GitHub', 'CHATBRIDGE_GITHUB_OAUTH_COMPLETE', {
          ok: false,
          state,
          error: error || 'Missing OAuth code or state',
        })
      )
      return
    }

    const redis = await getRedisClient()
    const rawState = await redis.get(githubOAuthRedisKey(state))
    await redis.del(githubOAuthRedisKey(state))

    if (!rawState) {
      response
        .status(400)
        .type('html')
        .send(renderOAuthCallbackHtml('GitHub', 'CHATBRIDGE_GITHUB_OAUTH_COMPLETE', { ok: false, state, error: 'OAuth state expired' }))
      return
    }

    const parsedState = z
      .object({
        userId: z.string().min(1),
        sessionId: z.string().nullable(),
      })
      .parse(JSON.parse(rawState))

    const tokenResponse = await exchangeGitHubAuthorizationCode(code)
    if (!tokenResponse.access_token) {
      throw new Error(tokenResponse.error_description || tokenResponse.error || 'GitHub OAuth did not return an access token')
    }

    await upsertGitHubToken(parsedState.userId, {
      accessToken: tokenResponse.access_token,
    })

    response.type('html').send(renderOAuthCallbackHtml('GitHub', 'CHATBRIDGE_GITHUB_OAUTH_COMPLETE', { ok: true, state }))
  } catch (error) {
    next(error)
  }
})

oauthRouter.delete('/github', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    await disconnectGitHub(request.auth!.userId)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

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
        renderOAuthCallbackHtml('Spotify', 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE', {
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
      response
        .status(400)
        .type('html')
        .send(renderOAuthCallbackHtml('Spotify', 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE', { ok: false, state, error: 'OAuth state expired' }))
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

    response.type('html').send(renderOAuthCallbackHtml('Spotify', 'CHATBRIDGE_SPOTIFY_OAUTH_COMPLETE', { ok: true, state }))
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

// Slack OAuth Routes

oauthRouter.get('/slack/status', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const token = await getStoredSlackToken(request.auth!.userId)
    response.json({
      connected: Boolean(token),
      teamName: token?.teamName || null,
    })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/slack/connect', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      response.status(503).json({ error: 'Slack OAuth is not configured.' })
      return
    }

    const { sessionId } = CONNECT_QUERY_SCHEMA.parse(request.query)
    const state = crypto.randomUUID()
    const redis = await getRedisClient()
    await redis.setEx(
      slackOAuthRedisKey(state),
      600,
      JSON.stringify({
        userId: request.auth!.userId,
        sessionId: sessionId || null,
      })
    )

    const authorizeUrl = new URL('https://slack.com/oauth/v2/authorize')
    authorizeUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID)
    authorizeUrl.searchParams.set('user_scope', SLACK_SCOPES)
    authorizeUrl.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI)
    authorizeUrl.searchParams.set('state', state)

    response.json({ authorizeUrl: authorizeUrl.toString(), state })
  } catch (error) {
    next(error)
  }
})

oauthRouter.get('/slack/callback', async (request, response, next) => {
  try {
    const { code, state, error } = CALLBACK_QUERY_SCHEMA.parse(request.query)

    if (error || !code || !state) {
      response.status(400).type('html').send(
        renderOAuthCallbackHtml('Slack', 'CHATBRIDGE_SLACK_OAUTH_COMPLETE', {
          ok: false,
          state,
          error: error || 'Missing OAuth code or state',
        })
      )
      return
    }

    const redis = await getRedisClient()
    const rawState = await redis.get(slackOAuthRedisKey(state))
    await redis.del(slackOAuthRedisKey(state))

    if (!rawState) {
      response
        .status(400)
        .type('html')
        .send(renderOAuthCallbackHtml('Slack', 'CHATBRIDGE_SLACK_OAUTH_COMPLETE', { ok: false, state, error: 'OAuth state expired' }))
      return
    }

    const parsedState = z
      .object({
        userId: z.string().min(1),
        sessionId: z.string().nullable(),
      })
      .parse(JSON.parse(rawState))

    const tokenResponse = await exchangeSlackAuthorizationCode(code)

    await upsertSlackToken(parsedState.userId, tokenResponse)

    response.type('html').send(renderOAuthCallbackHtml('Slack', 'CHATBRIDGE_SLACK_OAUTH_COMPLETE', { ok: true, state }))
  } catch (error) {
    next(error)
  }
})

oauthRouter.delete('/slack', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    await disconnectSlack(request.auth!.userId)
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
