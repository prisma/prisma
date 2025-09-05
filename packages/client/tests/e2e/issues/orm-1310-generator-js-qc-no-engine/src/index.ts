import assert from 'node:assert/strict'

import { PrismaClient as PrismaClient1 } from '@prisma/client'

import { PrismaClient as PrismaClient2 } from '../generated/prisma/client'

async function main() {
  for (const PrismaClient of [PrismaClient1, PrismaClient2]) {
    const prisma = new PrismaClient()

    // Check that it should fail with the expected error and not crash with
    // "WASM query compiler was unexpectedly `undefined`".
    await assert.rejects(async () => {
      await prisma.user.create({
        data: { email: 'john@doe.io' },
      })
    }, /fetch failed/)
  }
}

void main()
