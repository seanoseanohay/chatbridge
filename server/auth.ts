import jwt from 'jsonwebtoken'
import { env } from './config'

export interface AuthTokenPayload {
  userId: string
  tenantId: string
  role: string
}

export function signJwt(payload: AuthTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '24h' })
}

export function verifyJwt(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload
}
