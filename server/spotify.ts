import { env } from './config'
import { query } from './db/client'

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com'
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

type SpotifyTokenRow = {
  access_token: string
  refresh_token: string
  expires_at: string
}

type SpotifyTokenResponse = {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token?: string
}

function getSpotifyBasicAuthHeader() {
  return `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
}

async function fetchSpotifyToken(params: URLSearchParams) {
  const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: getSpotifyBasicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Spotify token exchange failed (${response.status}): ${detail}`)
  }

  return (await response.json()) as SpotifyTokenResponse
}

export async function exchangeSpotifyAuthorizationCode(code: string) {
  return fetchSpotifyToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
    })
  )
}

export async function refreshSpotifyAccessToken(refreshToken: string) {
  return fetchSpotifyToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
  )
}

export async function upsertSpotifyToken(
  userId: string,
  token: {
    accessToken: string
    refreshToken: string
    expiresInSeconds: number
  }
) {
  await query(
    `
      insert into oauth_tokens (user_id, provider, access_token, refresh_token, expires_at)
      values ($1, 'spotify', $2, $3, now() + ($4 || ' seconds')::interval)
      on conflict (user_id, provider)
      do update
      set access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          expires_at = excluded.expires_at
    `,
    [userId, token.accessToken, token.refreshToken, token.expiresInSeconds]
  )
}

export async function getStoredSpotifyToken(userId: string) {
  const result = await query<SpotifyTokenRow>(
    `
      select access_token, refresh_token, expires_at
      from oauth_tokens
      where user_id = $1 and provider = 'spotify'
      limit 1
    `,
    [userId]
  )

  return result.rows[0] || null
}

export async function disconnectSpotify(userId: string) {
  await query(`delete from oauth_tokens where user_id = $1 and provider = 'spotify'`, [userId])
}

export async function getValidSpotifyAccessToken(userId: string) {
  const stored = await getStoredSpotifyToken(userId)
  if (!stored) {
    throw new Error('Spotify account is not connected')
  }

  const expiresAt = new Date(stored.expires_at)
  if (expiresAt.getTime() - Date.now() > 60_000) {
    return stored.access_token
  }

  const refreshed = await refreshSpotifyAccessToken(stored.refresh_token)
  await upsertSpotifyToken(userId, {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token || stored.refresh_token,
    expiresInSeconds: refreshed.expires_in,
  })

  return refreshed.access_token
}

export async function spotifyApiRequest<T>(userId: string, path: string, init?: RequestInit) {
  const accessToken = await getValidSpotifyAccessToken(userId)
  const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Spotify API request failed (${response.status}): ${detail}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
