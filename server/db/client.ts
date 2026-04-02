import { Pool, type QueryResultRow } from 'pg'
import { env } from '../config'

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
})

export async function query<T extends QueryResultRow>(text: string, values?: unknown[]) {
  return pgPool.query<T>(text, values)
}
