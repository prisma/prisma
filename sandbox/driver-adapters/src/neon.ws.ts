import { neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { WebSocket } from 'undici'
import { smokeTest } from './test'

neonConfig.wsProxy = () => `127.0.0.1:5488/v1`
neonConfig.webSocketConstructor = WebSocket
neonConfig.useSecureWebSocket = false // disable tls
neonConfig.pipelineConnect = false

async function main() {
  const connectionString = `${process.env.JS_NEON_DATABASE_URL as string}`
  console.log('connectionString', connectionString)

  const adapter = new PrismaNeon({
    connectionString,
  })

  await smokeTest(adapter)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
