import { createPgConnector } from '@jkomyno/prisma-pg-js-connector'
import { smokeTest } from './test'

async function pg() {
  const connectionString = `${process.env.JS_PG_DATABASE_URL as string}`

  const jsConnector = createPgConnector({
    url: connectionString,
  })

  await smokeTest(jsConnector)
}

pg().catch((e) => {
  console.error(e)
  process.exit(1)
})
