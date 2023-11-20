import { neon } from '@neondatabase/serverless'
import { PrismaNeonHTTP } from '@prisma/adapter-neon'
import { smokeTest } from './test'

async function main() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const connection = neon(connectionString, {
    arrayMode: false,
    fullResults: true,
  })
  const adapter = new PrismaNeonHTTP(connection)

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
