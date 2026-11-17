import { neon } from '@neondatabase/serverless'

/**
 * Runs one SQL query with $1, $2… placeholders and returns the rows.
 * On Vercel this talks to Neon. When DATABASE_URL points at this computer
 * (localhost), it uses a plain Postgres connection instead, so the site can be
 * previewed against a local copy of the database.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')

  if (isLocal(url)) {
    const pool = await localPool(url)
    return (await pool.query(text, params)).rows as T[]
  }
  return (await neon(url).query(text, params)) as T[]
}

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || url.includes('host=/')
  } catch {
    return false
  }
}

// Only the part of the 'pg' library used here (it ships without type definitions).
type LocalPool = { query(text: string, params: unknown[]): Promise<{ rows: unknown[] }> }

let pool: LocalPool | undefined
async function localPool(url: string): Promise<LocalPool> {
  if (!pool) {
    // @ts-expect-error: 'pg' has no type definitions installed
    const pg = await import('pg')
    pool = new pg.default.Pool({ connectionString: url }) as LocalPool
  }
  return pool
}
