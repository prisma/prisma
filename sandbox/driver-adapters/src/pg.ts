import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import { smokeTest } from './test'

async function main() {
  const connectionString = `${process.env.JS_PG_DATABASE_URL as string}`

  const pool = new Pool({ connectionString })
  const adapters = new PrismaPg(pool)

  await smokeTest(adapters)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
