import { connect } from '@planetscale/database'
import { PrismaPlanetScale } from '@jkomyno/prisma-adapter-planetscale'
import { bindAdapter } from '@jkomyno/prisma-driver-adapter-utils'
import { smokeTestLibquery } from './libquery' 

async function main() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const planetscale = connect({ url: connectionString })
  const adapter = new PrismaPlanetScale(planetscale)
  const driverAdapter = bindAdapter(adapter)

  await smokeTestLibquery(driverAdapter, '../../prisma/mysql/schema.prisma')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
