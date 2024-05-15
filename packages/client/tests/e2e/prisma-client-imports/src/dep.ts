/* eslint-disable import/no-duplicates */
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaNeon, PrismaNeonHTTP } from '@prisma/adapter-neon'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaPgWorker } from '@prisma/adapter-pg-worker'
import { PrismaPlanetscale } from '@prisma/adapter-planetscale'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
import { PgWorker } from '@prisma/pg-worker'
import { PrismaClient } from 'db'
import { PrismaClientKnownRequestError as E1 } from 'db/runtime/library'
import { PrismaClientKnownRequestError as E2 } from 'db/runtime/library.js'

export const errors = [E1, E2]
export const client = new PrismaClient()
export const accelerateClient = client.$extends(withAccelerate())
export const replicaClient = client.$extends(readReplicas({ url: '' }))

void client.user.findMany()
void accelerateClient.user.findMany()
void replicaClient.user.findMany()

/* Driver Adapters */
export const d1Client = new PrismaClient({
  adapter: new PrismaD1('something'),
})
void d1Client.user.findMany()

export const libsqlClient = new PrismaClient({
  adapter: new PrismaLibSql(),
})
void libsqlClient.user.findMany()

export const neonClient = new PrismaClient({
  adapter: new PrismaNeon(),
})
void neonClient.user.findMany()

export const neonHttpClient = new PrismaClient({
  adapter: new PrismaNeonHTTP(),
})
void neonHttpClient.user.findMany()

export const pgClient = new PrismaClient({
  adapter: new PrismaPg(),
})
void pgClient.user.findMany()

export const pgWorkerClient = new PrismaClient({
  adapter: new PrismaPgWorker(),
})
void pgWorkerClient.user.findMany()

export const planetscaleClient = new PrismaClient({
  adapter: new PrismaPlanetscale(),
})
void planetscaleClient.user.findMany()
