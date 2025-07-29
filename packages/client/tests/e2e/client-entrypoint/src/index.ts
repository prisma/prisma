import assert from 'node:assert/strict'

import { PrismaClient } from './generated/prisma/client'

async function main() {
  const prisma = new PrismaClient()

  await prisma.user.create({
    data: { email: 'john@doe.io' },
  })

  assert.equal((await prisma.user.findMany()).length, 1)
}

void main()
