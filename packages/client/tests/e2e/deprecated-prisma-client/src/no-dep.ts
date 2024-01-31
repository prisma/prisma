import { PrismaClient } from '../custom'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClientKnownRequestError as E1 } from '../custom/runtime/library'
/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClientKnownRequestError as E2 } from '../custom/runtime/library.js'

export const client = new PrismaClient()

void client.user.findMany()
