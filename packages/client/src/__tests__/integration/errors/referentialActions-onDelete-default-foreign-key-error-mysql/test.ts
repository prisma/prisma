import path from 'node:path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma

describe('referentialActions-onDelete-default-foreign-key-error(mysql)', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_MYSQL_URI!.replace('tests', 'tests-referentialActions-onDelete-default')
    await tearDownMysql(process.env.DATABASE_URL)
    await migrateDb({
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.post.deleteMany()
    await prisma.profile.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('delete 1 user, should error', async () => {
    await prisma.user.create({
      data: {
        name: 'Bob',
        email: 'bob@prisma.io',
        posts: {
          create: { title: 'Hello Earth' },
        },
        profile: {
          create: { bio: 'I like penguins' },
        },
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)
    expect(await prisma.profile.findMany()).toHaveLength(1)
    expect(await prisma.post.findMany()).toHaveLength(1)

    try {
      await prisma.user.delete({
        where: {
          email: 'bob@prisma.io',
        },
      })
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(`

        Invalid \`prisma.user.delete()\` invocation in
        /client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-mysql/test.ts:0:0

          44 expect(await prisma.post.findMany()).toHaveLength(1)
          45 
          46 try {
        → 47   await prisma.user.delete(
        Foreign key constraint violated: \`authorId\`
      `)
      expect(await prisma.user.findMany()).toHaveLength(1)
      expect(await prisma.profile.findMany()).toHaveLength(1)
      expect(await prisma.post.findMany()).toHaveLength(1)
    }
  })
})
