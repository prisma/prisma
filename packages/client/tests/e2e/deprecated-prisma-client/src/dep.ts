import { PrismaClient } from 'db'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClientKnownRequestError as E1 } from 'db/runtime/library'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { PrismaClientKnownRequestError as E2 } from 'db/runtime/library.js'

export const client = new PrismaClient()

void client.user.findMany()
