import { createPlanetScaleConnector } from '@jkomyno/prisma-planetscale-js-connector'
import { fetch as undiciFetch } from 'undici'
import { smokeTest } from './test' 

async function planetscale() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const jsConnector = createPlanetScaleConnector({
    url: connectionString,

    /**
     * Custom `fetch` implementation is only necessary on Node.js < v18.x.x.
     */
    fetch: undiciFetch,
  })

  await smokeTest(jsConnector, '../prisma/mysql-planetscale/schema.prisma')
}

planetscale().catch((e) => {
  console.error(e)
  process.exit(1)
})
