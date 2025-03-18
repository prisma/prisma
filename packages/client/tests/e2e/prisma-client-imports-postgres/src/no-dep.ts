import { neonConfig } from '@neondatabase/serverless'
// import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaNeon, PrismaNeonHTTP } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPg as PrismaPgWorker } from '@prisma/adapter-pg-worker'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
import ws from 'ws'

import { PrismaClient } from '../custom'
import { PrismaClientKnownRequestError as E1 } from '../custom/runtime/library'
import { PrismaClientKnownRequestError as E2 } from '../custom/runtime/library.js'

// Setup
neonConfig.webSocketConstructor = ws

const connectionString = 'just-a-string'

export const errors = [E1, E2]
export const client = new PrismaClient()
void client.user.findMany()

export const accelerateClient = client.$extends(withAccelerate())
void accelerateClient.user.findMany()

export const replicaClient = client.$extends(readReplicas({ url: '' }))
void replicaClient.user.findMany()

/* Driver Adapters */
export const neonPrismaClient = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
})
void neonPrismaClient.user.findMany()

export const neonHttpPrismaClient = new PrismaClient({
  adapter: new PrismaNeonHTTP('postgresql://user:password@example.com/dbname', {
    arrayMode: false,
    fullResults: true,
  }),
})
void neonHttpPrismaClient.user.findMany()

export const pgPrismaClient = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})
void pgPrismaClient.user.findMany()

export const pgWorkerPrismaClient = new PrismaClient({
  adapter: new PrismaPgWorker({ connectionString }),
})
void pgWorkerPrismaClient.user.findMany()
