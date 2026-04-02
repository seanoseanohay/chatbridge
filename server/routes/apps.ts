import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { getRegistryEntry, listRegistryEntries } from '../registry'

export const appsRouter = Router()

appsRouter.use(requireAuth)

appsRouter.get('/', (_request, response) => {
  response.json({
    apps: listRegistryEntries().map((entry) => ({
      appId: entry.appId,
      origin: entry.origin,
      enabled: entry.enabled,
      manifest: entry.manifest,
    })),
  })
})

appsRouter.get('/:appId', (request, response) => {
  const entry = getRegistryEntry(request.params.appId)
  if (!entry || !entry.enabled) {
    response.status(404).json({ error: 'App not found' })
    return
  }

  response.json({
    appId: entry.appId,
    origin: entry.origin,
    enabled: entry.enabled,
    manifest: entry.manifest,
  })
})
