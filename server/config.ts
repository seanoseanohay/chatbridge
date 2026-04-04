import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4302),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  OPENWEATHER_API_KEY: z.string().default(''),
  GITHUB_CLIENT_ID: z.string().default(''),
  GITHUB_CLIENT_SECRET: z.string().default(''),
  GITHUB_REDIRECT_URI: z.string().url().default('http://localhost:4302/api/oauth/github/callback'),
  GITHUB_OWNER: z.string().default(''),
  GITHUB_REPO: z.string().default(''),
  SPOTIFY_CLIENT_ID: z.string().default(''),
  SPOTIFY_CLIENT_SECRET: z.string().default(''),
  SPOTIFY_REDIRECT_URI: z.string().url().default('http://localhost:4302/api/oauth/spotify/callback'),
})

export const env = EnvSchema.parse(process.env)
