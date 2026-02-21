import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const createDbClient = (databaseUrl: string) => {
  if (!databaseUrl) {
    throw new Error('databaseUrl is required')
  }

  const sql = postgres(databaseUrl)
  const db = drizzle(sql, { schema })

  const close = async () => {
    await sql.end({ timeout: 5 })
  }

  return {
    sql,
    db,
    close,
  }
}
