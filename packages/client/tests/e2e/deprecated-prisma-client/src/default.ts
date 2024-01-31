import { PrismaClient } from '@prisma/client'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClientKnownRequestError as E1 } from '@prisma/client/runtime/library'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClientKnownRequestError as E2 } from '@prisma/client/runtime/library.js'

export const client = new PrismaClient()

void client.user.findMany()
