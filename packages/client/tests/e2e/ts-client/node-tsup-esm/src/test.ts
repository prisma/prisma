import assert from 'node:assert/strict'

import { PrismaClient } from './generated/prisma/client'

const prisma = new PrismaClient()

await prisma.user.deleteMany()

const user = await prisma.user.create({
  data: { email: 'john@doe.io' },
})

console.log(user)

assert.equal(await prisma.user.count(), 1)
