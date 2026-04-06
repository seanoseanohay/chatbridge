import { query } from './db/client'
import { z } from 'zod'

export interface SlackToken {
  accessToken: string
  teamId: string
  teamName: string
}

const SLACK_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year (Slack tokens don't expire by default)

export async function upsertSlackToken(
  userId: string,
  token: SlackToken
): Promise<void> {
  await query(
    `
      insert into oauth_tokens (user_id, provider, access_token, metadata, expires_at)
      values ($1, 'slack', $2, $3, now() + ($4 || ' seconds')::interval)
      on conflict (user_id, provider)
      do update set access_token = excluded.access_token, metadata = excluded.metadata, expires_at = excluded.expires_at
    `,
    [
      userId,
      token.accessToken,
      JSON.stringify({ teamId: token.teamId, teamName: token.teamName }),
      SLACK_TOKEN_TTL_SECONDS,
    ]
  )
}

export async function getStoredSlackToken(userId: string): Promise<SlackToken | null> {
  const result = await query<{ access_token: string; metadata: string }>(
    `
      select access_token, metadata
      from oauth_tokens
      where user_id = $1 and provider = 'slack' and (expires_at is null or expires_at > now())
      limit 1
    `,
    [userId]
  )

  if (!result.rows.length) {
    return null
  }

  const row = result.rows[0]
  const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata
  return {
    accessToken: row.access_token,
    teamId: metadata.teamId,
    teamName: metadata.teamName,
  }
}

export async function disconnectSlack(userId: string): Promise<void> {
  await query(
    `
      delete from oauth_tokens
      where user_id = $1 and provider = 'slack'
    `,
    [userId]
  )
}

export async function slackApiRequest<T>(
  userId: string,
  endpoint: string,
  params?: Record<string, unknown>
): Promise<T> {
  const token = await getStoredSlackToken(userId)
  if (!token) {
    throw new Error('Slack token not found')
  }

  const url = new URL(`https://slack.com/api/${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    throw new Error(`Slack API request failed with status ${response.status}`)
  }

  const data = (await response.json()) as { ok: boolean; error?: string } & T

  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error || 'unknown'}`)
  }

  return data
}

export async function getValidSlackAccessToken(userId: string): Promise<string> {
  const token = await getStoredSlackToken(userId)
  if (!token) {
    throw new Error('Slack token not found')
  }
  return token.accessToken
}

export async function exchangeSlackAuthorizationCode(code: string): Promise<SlackToken> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || '',
      client_secret: process.env.SLACK_CLIENT_SECRET || '',
      code,
      redirect_uri: process.env.SLACK_REDIRECT_URI || '',
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(`Slack token exchange failed with status ${response.status}`)
  }

  const data = (await response.json()) as {
    ok: boolean
    error?: string
    access_token?: string
    team?: { id: string; name: string }
  }

  if (!data.ok) {
    throw new Error(`Slack token exchange error: ${data.error || 'unknown'}`)
  }

  if (!data.access_token || !data.team) {
    throw new Error('Slack token exchange did not return required fields')
  }

  return {
    accessToken: data.access_token,
    teamId: data.team.id,
    teamName: data.team.name,
  }
}
