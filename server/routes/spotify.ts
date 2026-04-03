import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'
import { spotifyApiRequest } from '../spotify'

const CreatePlaylistBodySchema = z.object({
  prompt: z.string().min(1),
  trackCount: z.number().int().min(1).max(20).optional(),
})

type SpotifyProfile = {
  id: string
}

type SpotifySearchResponse = {
  tracks?: {
    items: Array<{
      uri: string
      name: string
      external_urls?: { spotify?: string }
      artists?: Array<{ name: string }>
    }>
  }
}

type SpotifyPlaylistResponse = {
  id: string
  name: string
  external_urls?: {
    spotify?: string
  }
}

function buildPlaylistName(prompt: string) {
  const cleaned = prompt.trim().replace(/\s+/g, ' ')
  if (!cleaned) {
    return 'ChatBridge Playlist'
  }
  return cleaned.length > 60 ? `${cleaned.slice(0, 57)}...` : cleaned
}

export const spotifyRouter = Router()

spotifyRouter.use(requireAuth)

spotifyRouter.post('/playlists', async (request: AuthenticatedRequest, response, next) => {
  try {
    const { prompt, trackCount = 10 } = CreatePlaylistBodySchema.parse(request.body)
    const userId = request.auth!.userId

    const profile = await spotifyApiRequest<SpotifyProfile>(userId, '/me')
    const search = await spotifyApiRequest<SpotifySearchResponse>(
      userId,
      `/search?type=track&limit=${trackCount}&q=${encodeURIComponent(prompt)}`
    )

    const tracks = search.tracks?.items || []
    if (!tracks.length) {
      response.status(404).json({ error: 'No matching Spotify tracks found' })
      return
    }

    const playlist = await spotifyApiRequest<SpotifyPlaylistResponse>(userId, `/users/${profile.id}/playlists`, {
      method: 'POST',
      body: JSON.stringify({
        name: buildPlaylistName(prompt),
        description: `Created by ChatBridge for: ${prompt}`,
        public: false,
      }),
    })

    await spotifyApiRequest(userId, `/playlists/${playlist.id}/tracks`, {
      method: 'POST',
      body: JSON.stringify({
        uris: tracks.map((track) => track.uri),
      }),
    })

    response.status(201).json({
      playlistId: playlist.id,
      playlistName: playlist.name,
      playlistUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
      embedUrl: `https://open.spotify.com/embed/playlist/${playlist.id}`,
      tracks: tracks.map((track) => ({
        name: track.name,
        artist: track.artists?.map((artist) => artist.name).join(', ') || 'Unknown artist',
        url: track.external_urls?.spotify || null,
      })),
    })
  } catch (error) {
    next(error)
  }
})
