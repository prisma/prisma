import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
describe('referentialActions-onDelete-default-foreign-key-error(sqlserver)', () => {
  beforeAll(async () => {
    await migrateDb({
      connectionString: process.env.TEST_MSSQL_JDBC_URI!,
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
          create: { bio: 'I like pinguins' },
        },
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)

    try {
      await prisma.user.delete({
        where: {
          email: 'bob@prisma.io',
        },
      })
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(`

        Invalid \`prisma.user.delete()\` invocation in
        /client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-sqlserver/test.ts:0:0

          39 expect(await prisma.user.findMany()).toHaveLength(1)
          40 
          41 try {
        → 42   await prisma.user.delete(
          Foreign key constraint failed on the field: \`PostDefaultOnDelete_authorId_fkey (index)\`
      `)
    }
  })
})
