import { connect } from '@planetscale/database'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { smokeTest } from './test'

async function main() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL as string}`

  const connection = connect({ url: connectionString })
  const adapter = new PrismaPlanetScale(connection)

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
