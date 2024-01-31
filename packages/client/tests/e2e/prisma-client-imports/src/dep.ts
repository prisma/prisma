/* eslint-disable import/no-duplicates */
import { withAccelerate } from '@prisma/extension-accelerate'
import { readReplicas } from '@prisma/extension-read-replicas'
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
