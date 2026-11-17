// Database commands. Run from the project folder:
//   pnpm db:migrate      apply any new files in migrations/ (in number order)
//   pnpm db:seed         add (or refresh) the test data in seeds/test-data.sql
//   pnpm db:unseed       remove all test data
// Uses DATABASE_URL, read from .env.local if present (`vercel env pull .env.local`).

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import pg from 'pg'

const root = new URL('..', import.meta.url).pathname
const command = process.argv[2]

if (!['migrate', 'seed', 'unseed'].includes(command)) {
  console.error('Usage: node scripts/db.mjs migrate | seed | unseed')
  process.exit(1)
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run `vercel env pull .env.local` first.')
  process.exit(1)
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

// Runs SQL inside a transaction: all of it happens, or none of it does.
async function inTransaction(fn) {
  await client.query('BEGIN')
  try {
    await fn()
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}

async function migrate() {
  // Stop two people running migrations at the same moment.
  await client.query('SELECT pg_advisory_lock(727001)')
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        text PRIMARY KEY,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`)
  const done = new Set(
    (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  )
  const files = (await readdir(join(root, 'migrations')))
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()

  let applied = 0
  for (const file of files) {
    if (done.has(file)) continue
    const sql = await readFile(join(root, 'migrations', file), 'utf8')
    await inTransaction(async () => {
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    })
    console.log(`Applied ${file}`)
    applied++
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : 'Database already up to date.')
}

async function runSeedFile(name) {
  const sql = await readFile(join(root, 'seeds', name), 'utf8')
  return sql
}

try {
  if (command === 'migrate') {
    await migrate()
  } else if (command === 'seed') {
    const remove = await runSeedFile('remove-test-data.sql')
    const add = await runSeedFile('test-data.sql')
    await inTransaction(async () => {
      await client.query(remove)
      await client.query(add)
    })
    const { rows } = await client.query(
      `SELECT e.title, e.event_date::text AS date,
              (SELECT count(*) FROM orders o WHERE o.event_id = e.id) AS orders
         FROM events e WHERE e.is_test`,
    )
    for (const r of rows) console.log(`Test data ready: ${r.title} on ${r.date}, ${r.orders} orders.`)
  } else {
    await inTransaction(async () => {
      await client.query(await runSeedFile('remove-test-data.sql'))
    })
    console.log('All test data removed.')
  }
} catch (err) {
  console.error(`Failed: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
