/* eslint-disable import/no-duplicates */
import { D1Database } from '@cloudflare/workers-types'
import { neon, neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import { Client as PlanetScaleClient } from '@planetscale/database'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaNeon, PrismaNeonHTTP } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPg as PrismaPgWorker } from '@prisma/adapter-pg-worker'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { PrismaClient } from '@prisma/client'
// @ts-ignore no types available
import * as G1 from '@prisma/client/generator-build'
// @ts-ignore no types available
import * as G2 from '@prisma/client/generator-build/index.js'
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/library'
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/library.js'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
import { Pool as PgWorkerPool } from '@prisma/pg-worker'
import { Pool as PgPool } from 'pg'
import ws from 'ws'

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

export const generators = [G1, G2]

/* Driver Adapters */
const d1Db = {} as D1Database
export const d1PrismaClient = new PrismaClient({
  adapter: new PrismaD1(d1Db),
})
void d1PrismaClient.user.findMany()

const neonPool = new NeonPool({ connectionString })
export const neonPrismaClient = new PrismaClient({
  adapter: new PrismaNeon(neonPool),
})
void neonPrismaClient.user.findMany()

const neonConnection = neon('postgresql://user:password@example.com/dbname', {
  arrayMode: false,
  fullResults: true,
})
export const neonHttpPrismaClient = new PrismaClient({
  adapter: new PrismaNeonHTTP(neonConnection),
})
void neonHttpPrismaClient.user.findMany()

const pgPool = new PgPool({ connectionString })
export const pgPrismaClient = new PrismaClient({
  adapter: new PrismaPg(pgPool),
})
void pgPrismaClient.user.findMany()

const pgWorkerPool = new PgWorkerPool({ connectionString })
export const pgWorkerPrismaClient = new PrismaClient({
  adapter: new PrismaPgWorker(pgWorkerPool),
})
void pgWorkerPrismaClient.user.findMany()

const planetScaleClient = new PlanetScaleClient({ url: connectionString })
export const planetScalePrismaClient = new PrismaClient({
  adapter: new PrismaPlanetScale(planetScaleClient),
})
void planetScalePrismaClient.user.findMany()
