import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

import { TX_ID } from '../../../../runtime/getPrismaClient'
import { generateTestClient } from '../../../../utils/getTestClient'

beforeAll(() => {
  fs.copyFileSync(path.join(__dirname, 'dev.db'), path.join(__dirname, 'dev2.db'))
})

test('manual transaction rollback', async () => {
  await generateTestClient()
  const {
    PrismaClient,
    Prisma: { prismaVersion },
  } = require('./node_modules/@prisma/client')
  const originalClient = new PrismaClient()
  const db = await originalClient.$beginTransaction()

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  expect(await db.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(0)
  await db.user.create({
    data: {
      email: 'simsve@newcubator.com',
    },
  })
  expect(await db.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(1)

  await db.$rollbackTransaction()

  expect(await originalClient.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(0)

  await originalClient.$disconnect()
})

test('manual transaction commit', async () => {
  await generateTestClient()
  const {
    PrismaClient,
    Prisma: { prismaVersion },
  } = require('./node_modules/@prisma/client')
  const originalClient = new PrismaClient()
  let db = await originalClient.$beginTransaction()

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  expect(await db.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(0)
  await db.user.create({
    data: {
      email: 'simsve@newcubator.com',
    },
  })
  expect(await db.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(1)

  await db.$commitTransaction()

  expect(await originalClient.user.findMany({ where: { email: 'simsve@newcubator.com' } })).toHaveLength(1)

  await expect(() => db.$rollbackTransaction()).rejects.toThrow()

  db = await originalClient.$beginTransaction()
  const email = crypto.randomBytes(20).toString('hex') + '@newcubator.com'

  // intentionally use the same email 2 times to see, if the transaction gets rolled back properly
  try {
    db.user.create({
      data: {
        email,
      },
    })
    db.user.create({
      data: {
        email,
      },
    })
  } catch (e) {
    expect(e.code).toBe('P2002')
    expect(e.message.includes('P2002')).toBe(true)
  }

  await originalClient.$disconnect()
})

test('manual transaction commit without making changes', async () => {
  await generateTestClient()
  const {
    PrismaClient,
    Prisma: { prismaVersion },
  } = require('./node_modules/@prisma/client')
  const originalClient = new PrismaClient()
  const db = await originalClient.$beginTransaction()

  if (!prismaVersion || !prismaVersion.client) {
    throw new Error(`prismaVersion missing: ${JSON.stringify(prismaVersion)}`)
  }

  expect(db[TX_ID]).not.toBeUndefined()

  await db.$commitTransaction()

  await expect(() => db.$rollbackTransaction()).rejects.toThrow()

  await originalClient.$disconnect()
})
