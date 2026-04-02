import { createClient } from 'redis'
import { env } from '../config'

let redisClientPromise: Promise<ReturnType<typeof createClient>> | null = null

export async function getRedisClient() {
  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url: env.REDIS_URL })
      client.on('error', (error) => {
        console.error('redis:error', error)
      })
      await client.connect()
      return client
    })()
  }

  return redisClientPromise
}
