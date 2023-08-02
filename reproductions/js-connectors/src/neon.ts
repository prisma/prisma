import { createNeonConnector } from '@jkomyno/prisma-neon-js-connector'
import { smokeTest } from './test'

async function neon() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const jsConnector = createNeonConnector({
    url: connectionString,
  })

  await smokeTest(jsConnector, '../prisma/postgres-neon/schema.prisma')
}

neon().catch((e) => {
  console.error(e)
  process.exit(1)
})
