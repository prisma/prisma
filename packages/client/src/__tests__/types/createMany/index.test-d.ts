import { PrismaClient } from '.'
import { expectError } from 'tsd'

// tslint:disable

const prisma = new PrismaClient()

;(async () => {
  expectError(await prisma.post.createMany({}))
})()
