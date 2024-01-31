/* eslint-disable import/no-duplicates */
import { PrismaClient } from '@prisma/client'
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/library'
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/library.js'
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'

export const errors = [E1, E2]
export const client = new PrismaClient()
export const accelerateClient = client.$extends(withAccelerate())
export const replicaClient = client.$extends(readReplicas({ url: '' }))

void client.user.findMany()
void accelerateClient.user.findMany()
void replicaClient.user.findMany()
