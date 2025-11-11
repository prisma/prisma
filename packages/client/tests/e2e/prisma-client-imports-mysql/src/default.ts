import { PrismaPlanetScale } from '@prisma/adapter-planetscale'
import { PrismaClient } from '@prisma/client'
// @ts-ignore no types available
import * as G1 from '@prisma/client/generator-build'
// @ts-ignore no types available
import * as G2 from '@prisma/client/generator-build/index.js'
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/client'
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/client.js'
// import { withAccelerate } from '@prisma/extension-accelerate'
// import { readReplicas } from '@prisma/extension-read-replicas'

// Setup
const connectionString = 'just-a-string'

export const errors = [E1, E2]

// export const client = new PrismaClient()
// void client.user.findMany()

// export const accelerateClient = client.$extends(withAccelerate())
// void accelerateClient.user.findMany()

// export const replicaClient = client.$extends(readReplicas({ url: '' }))
// void replicaClient.user.findMany()

export const generators = [G1, G2]

/* Driver Adapters */
export const planetScalePrismaClient = new PrismaClient({
  adapter: new PrismaPlanetScale({ url: connectionString }),
})
void planetScalePrismaClient.user.findMany()
