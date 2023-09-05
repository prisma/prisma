import { PrismaNeonHTTP } from '@jkomyno/prisma-adapter-neon'
import { bindAdapter } from '@jkomyno/prisma-driver-adapter-utils'
import { neon } from '@neondatabase/serverless'
import { smokeTestLibquery } from './libquery' 

async function main() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const neonConnection = neon(connectionString, {
    arrayMode: false,
    fullResults: true,
  })

  const adapter = new PrismaNeonHTTP(neonConnection)
  const driverAdapter = bindAdapter(adapter)

  await smokeTestLibquery(driverAdapter, '../../prisma/postgres/schema.prisma')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
