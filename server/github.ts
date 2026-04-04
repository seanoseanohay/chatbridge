import { env } from './config'
import { query } from './db/client'

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth'
const GITHUB_API_URL = 'https://api.github.com'
const GITHUB_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365

type GitHubTokenRow = {
  access_token: string
  refresh_token: string
  expires_at: string
}

type GitHubTokenResponse = {
  access_token: string
  token_type: string
  scope: string
}

export async function exchangeGitHubAuthorizationCode(code: string) {
  const response = await fetch(`${GITHUB_OAUTH_URL}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GitHub token exchange failed (${response.status}): ${detail}`)
  }

  return (await response.json()) as GitHubTokenResponse & { error?: string; error_description?: string }
}

export async function upsertGitHubToken(
  userId: string,
  token: {
    accessToken: string
    refreshToken?: string
    expiresInSeconds?: number
  }
) {
  await query(
    `
      insert into oauth_tokens (user_id, provider, access_token, refresh_token, expires_at)
      values ($1, 'github', $2, $3, now() + ($4 || ' seconds')::interval)
      on conflict (user_id, provider)
      do update
      set access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          expires_at = excluded.expires_at
    `,
    [userId, token.accessToken, token.refreshToken || '', token.expiresInSeconds || GITHUB_TOKEN_TTL_SECONDS]
  )
}

export async function getStoredGitHubToken(userId: string) {
  const result = await query<GitHubTokenRow>(
    `
      select access_token, refresh_token, expires_at
      from oauth_tokens
      where user_id = $1 and provider = 'github'
      limit 1
    `,
    [userId]
  )

  return result.rows[0] || null
}

export async function disconnectGitHub(userId: string) {
  await query(`delete from oauth_tokens where user_id = $1 and provider = 'github'`, [userId])
}

export async function getValidGitHubAccessToken(userId: string) {
  const stored = await getStoredGitHubToken(userId)
  if (!stored) {
    throw new Error('GitHub account is not connected')
  }

  return stored.access_token
}

export async function githubApiRequest<T>(userId: string, path: string, init?: RequestInit) {
  const accessToken = await getValidGitHubAccessToken(userId)
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GitHub API request failed (${response.status}): ${detail}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
