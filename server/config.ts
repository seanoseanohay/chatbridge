import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4302),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  SPOTIFY_CLIENT_ID: z.string().default(''),
  SPOTIFY_CLIENT_SECRET: z.string().default(''),
  SPOTIFY_REDIRECT_URI: z.string().url().default('http://localhost:4302/api/oauth/spotify/callback'),
})

export const env = EnvSchema.parse(process.env)
