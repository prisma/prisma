/* eslint-disable import/no-duplicates */
import { PrismaClient } from '@prisma/client'
// @ts-ignore no types available
import * as G1 from '@prisma/client/generator-build'
// @ts-ignore no types available
import * as G2 from '@prisma/client/generator-build/index.js'
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/library'
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/library.js'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'

export const errors = [E1, E2]
export const client = new PrismaClient()
export const accelerateClient = client.$extends(withAccelerate())
export const replicaClient = client.$extends(readReplicas({ url: '' }))
export const generators = [G1, G2]

void client.user.findMany()
void accelerateClient.user.findMany()
void replicaClient.user.findMany()
