import { createPlanetScaleConnector } from '@jkomyno/prisma-planetscale-js-connector'
import { fetch as undiciFetch } from 'undici'
import { smokeTest } from './test' 

async function planetscale() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const jsConnector = createPlanetScaleConnector({
    url: connectionString,
    fetch: undiciFetch,
  })

  await smokeTest(jsConnector)
}

planetscale().catch((e) => {
  console.error(e)
  process.exit(1)
})
