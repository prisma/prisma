import { PrismaClient } from '.'
import { expectError } from 'tsd'

const prisma = new PrismaClient()

;(async () => {
  expectError(await prisma.post.createMany({}))
})()
