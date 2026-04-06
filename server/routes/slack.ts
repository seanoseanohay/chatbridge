import { Router } from 'express'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { slackApiRequest } from '../slack'

export const slackRouter = Router()

slackRouter.use(requireAuth)

slackRouter.get('/summary', async (request: AuthenticatedRequest, response, next) => {
  try {
    const userId = request.auth?.userId
    if (!userId) {
      response.status(401).json({ error: 'Unauthorized' })
      return
    }

    // Get the user's channels
    const channelsResponse = await slackApiRequest<{
      channels: Array<{ id: string; name: string; num_members: number }>
    }>(userId, 'conversations.list', {
      exclude_archived: 'true',
      types: 'public_channel,private_channel',
      limit: '50',
    })

    const channels = channelsResponse.channels || []

    // Sort by member count (larger channels first) and limit to 10
    const topChannels = channels.sort((a, b) => b.num_members - a.num_members).slice(0, 10)

    // Fetch messages from the last 24 hours for each channel
    const now = Math.floor(Date.now() / 1000)
    const yesterday = now - 86400

    const channelSummaries = await Promise.all(
      topChannels.map(async (channel) => {
        try {
          const messagesResponse = await slackApiRequest<{
            messages: Array<{ text: string; user?: string; username?: string }>
          }>(userId, 'conversations.history', {
            channel: channel.id,
            oldest: String(yesterday),
            latest: String(now),
            limit: '100',
          })

          const messages = messagesResponse.messages || []

          // Extract highlights (first 3 messages, up to ~100 chars each)
          const highlights = messages
            .slice(0, 3)
            .filter((msg) => msg.text && msg.text.trim())
            .map((msg) => {
              const user = msg.user || msg.username || 'unknown'
              const text = msg.text.split('\n')[0].substring(0, 80)
              return user + ': ' + text
            })

          return {
            id: channel.id,
            name: channel.name,
            messageCount: messages.length,
            highlights: highlights,
          }
        } catch (error) {
          console.warn('[slack] Failed to fetch messages for channel', channel.name, error)
          return {
            id: channel.id,
            name: channel.name,
            messageCount: 0,
            highlights: [],
          }
        }
      })
    )

    // Filter out channels with no messages
    const activeChannels = channelSummaries.filter((ch) => ch.messageCount > 0)

    // Get team info
    const teamResponse = await slackApiRequest<{
      team: { id: string; name: string }
    }>(userId, 'team.info')

    response.json({
      teamName: teamResponse.team?.name || 'Slack Workspace',
      channels: activeChannels,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    next(error)
  }
})
