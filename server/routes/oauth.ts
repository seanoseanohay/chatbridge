import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

export const oauthRouter = Router()

oauthRouter.get('/spotify/callback', (_request, response) => {
  response.status(501).json({ error: 'Spotify OAuth is not implemented yet' })
})

oauthRouter.get('/spotify/connect', requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Spotify OAuth is not implemented yet' })
})

oauthRouter.post('/spotify/refresh', requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Spotify OAuth is not implemented yet' })
})

oauthRouter.delete('/spotify', requireAuth, (_request, response) => {
  response.status(501).json({ error: 'Spotify OAuth is not implemented yet' })
})
