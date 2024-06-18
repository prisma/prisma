import { Client as PlanetScaleClient } from '@planetscale/database'
import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
import { PrismaClient } from 'db'
import { PrismaClientKnownRequestError as E1 } from 'db/runtime/library'
import { PrismaClientKnownRequestError as E2 } from 'db/runtime/library.js'

// Setup
const connectionString = 'just-a-string'

export const errors = [E1, E2]

export const client = new PrismaClient()
void client.user.findMany()

export const accelerateClient = client.$extends(withAccelerate())
void accelerateClient.user.findMany()

export const replicaClient = client.$extends(readReplicas({ url: '' }))
void replicaClient.user.findMany()

/* Driver Adapters */
const planetScaleClient = new PlanetScaleClient({ url: connectionString })
export const planetScalePrismaClient = new PrismaClient({
  adapter: new PrismaPlanetScale(planetScaleClient),
})
void planetScalePrismaClient.user.findMany()
