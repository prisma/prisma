import { neonConfig } from '@neondatabase/serverless'
// import { PrismaLibSql } from '@prisma/driver-libsql'
import { PrismaNeon, PrismaNeonHttp } from '@prisma/driver-neon'
import { PrismaPg } from '@prisma/driver-pg'
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
  driver: new PrismaNeon({ connectionString }),
})
void neonPrismaClient.user.findMany()

export const neonHttpPrismaClient = new PrismaClient({
  driver: new PrismaNeonHttp('postgresql://user:password@example.com/dbname', {
    arrayMode: false,
    fullResults: true,
  }),
})
void neonHttpPrismaClient.user.findMany()

export const pgPrismaClient = new PrismaClient({
  driver: new PrismaPg({ connectionString }),
})
void pgPrismaClient.user.findMany()
