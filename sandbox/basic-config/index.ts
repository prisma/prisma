import { setTimeout } from 'node:timers/promises'
import { PrismaClient } from '.prisma/client'
import prismaConfigFromEnv from './prisma.config'
import type { Env } from './env'

// Simulate a Cloudflare Worker request
async function onWorkerRequest(env: Env) {
  const prismaConfig = await prismaConfigFromEnv(env)
  const prisma = new PrismaClient(prismaConfig.client)

  await prisma.user.findMany()
}

onWorkerRequest({
  NEON_DATABASE_URL: 'postgresql://prisma:....@ep-steep-sun-a12321.us-east-2.aws.neon.tech/neondb?sslmode=require',
  PG_DATABASE_URL: 'postgresql://prisma:prisma@localhost:5432/tests',
})
  .then(async () => {
    console.log('config:done...')
    await setTimeout(5000)
    console.log('killing process now...')
    process.exit(0)
  })
