/* eslint-disable import/no-duplicates */
// import { createClient } from '@libsql/client'
import { D1Database } from '@cloudflare/workers-types'
import { neon, neonConfig, Pool as NeonPool } from '@neondatabase/serverless'
import { Client as PlanetScaleClient } from '@planetscale/database'
import { PrismaD1 } from '@prisma/adapter-d1'
// import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaNeon, PrismaNeonHTTP } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPg as PrismaPgWorker } from '@prisma/adapter-pg-worker'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
import { Pool as PgWorkerPool } from '@prisma/pg-worker'
import { PrismaClient } from 'db'
import { PrismaClientKnownRequestError as E1 } from 'db/runtime/library'
import { PrismaClientKnownRequestError as E2 } from 'db/runtime/library.js'
import { Pool as PgPool } from 'pg'
import ws from 'ws'

// Setup
neonConfig.webSocketConstructor = ws

const connectionString = 'just-a-string'

export const errors = [E1, E2]
export const client = new PrismaClient()
export const accelerateClient = client.$extends(withAccelerate())
export const replicaClient = client.$extends(readReplicas({ url: '' }))

void client.user.findMany()
void accelerateClient.user.findMany()
void replicaClient.user.findMany()

/* Driver Adapters */
const d1Db = {} as D1Database
export const d1Client = new PrismaClient({
  adapter: new PrismaD1(d1Db),
})
void d1Client.user.findMany()

// const libsql = createClient({
//   url: connectionString,
//   authToken: '',
// })
// export const libsqlClient = new PrismaClient({
//   adapter: new PrismaLibSQL(libsql),
// })
// void libsqlClient.user.findMany()

const neonPool = new NeonPool({ connectionString })
export const neonClient = new PrismaClient({
  adapter: new PrismaNeon(neonPool),
})
void neonClient.user.findMany()

const neonConnection = neon('postgresql://user:password@example.com/dbname', {
  arrayMode: false,
  fullResults: true,
})
export const neonHttpClient = new PrismaClient({
  adapter: new PrismaNeonHTTP(neonConnection),
})
void neonHttpClient.user.findMany()

const pgPool = new PgPool({ connectionString })
export const pgClient = new PrismaClient({
  adapter: new PrismaPg(pgPool),
})
void pgClient.user.findMany()

const pgWorkerPool = new PgWorkerPool({ connectionString })
export const pgWorkerClient = new PrismaClient({
  adapter: new PrismaPgWorker(pgWorkerPool),
})
void pgWorkerClient.user.findMany()

const planetScaleClient = new PlanetScaleClient({ url: connectionString })
export const planetscaleClient = new PrismaClient({
  adapter: new PrismaPlanetScale(planetScaleClient),
})
void planetscaleClient.user.findMany()
