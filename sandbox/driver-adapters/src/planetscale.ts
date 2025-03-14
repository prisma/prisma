import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { smokeTest } from './test'

async function main() {
  const connectionString = `${process.env.JS_PLANETSCALE_DATABASE_URL}`

  const adapter = new PrismaPlanetScale({ url: connectionString })

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
