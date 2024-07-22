import { Client } from '@planetscale/database'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { smokeTest } from './test'

async function main() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL}`

  const client = new Client({ url: connectionString })
  const adapter = new PrismaPlanetScale(client)

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
