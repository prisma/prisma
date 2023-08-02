import { createPlanetScaleConnector } from '@jkomyno/prisma-planetscale-js-connector'
import { smokeTest } from './test' 

async function planetscale() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const jsConnector = createPlanetScaleConnector({
    url: connectionString,
  })

  await smokeTest(jsConnector, '../prisma/mysql-planetscale/schema.prisma')
}

planetscale().catch((e) => {
  console.error(e)
  process.exit(1)
})
