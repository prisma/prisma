import { createNeonConnector } from '@jkomyno/prisma-neon-js-connector'
import { fetch as undiciFetch } from 'undici'
import { smokeTest } from './test'

async function neon() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`

  const jsConnector = createNeonConnector({
    url: connectionString,
    httpMode: false,
    fetchFunction: undiciFetch,
  })

  await smokeTest(jsConnector)
}

neon().catch((e) => {
  console.error(e)
  process.exit(1)
})
