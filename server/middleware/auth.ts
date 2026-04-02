import type { NextFunction, Request, Response } from 'express'
import { verifyJwt, type AuthTokenPayload } from '../auth'

export interface AuthenticatedRequest extends Request {
  auth?: AuthTokenPayload
}

export function requireAuth(request: AuthenticatedRequest, response: Response, next: NextFunction) {
  const authorization = request.header('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    response.status(401).json({ error: 'Missing bearer token' })
    return
  }

  try {
    request.auth = verifyJwt(authorization.slice('Bearer '.length))
    next()
  } catch {
    response.status(401).json({ error: 'Invalid or expired token' })
  }
}
