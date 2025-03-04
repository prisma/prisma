/* eslint-disable import/no-duplicates */
import type { D1Database } from '@cloudflare/workers-types'
import { PrismaD1 } from '@prisma/adapter-d1'
import { PrismaClient } from '@prisma/client'
// @ts-ignore no types available
import * as G1 from '@prisma/client/generator-build'
// @ts-ignore no types available
import * as G2 from '@prisma/client/generator-build/index.js'
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/library'
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/library.js'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'

// Setup
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
