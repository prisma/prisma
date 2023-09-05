import { connect } from '@planetscale/database'
import { PrismaPlanetScale } from '@jkomyno/prisma-adapter-planetscale'
import { describe } from 'node:test'
import { smokeTestClient } from './client'

describe('planetscale with @prisma/client', async () => {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const connnection = connect({ url: connectionString })
  const adapter = new PrismaPlanetScale(connnection)
  
  smokeTestClient(adapter)
})
