import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { migrateDb } from '../../__helpers__/migrateDb'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

let prisma
const baseUri = process.env.TEST_MSSQL_JDBC_URI

describeIf(!process.env.TEST_SKIP_MSSQL)('referentialActions-onDelete-default-foreign-key-error(sqlserver)', () => {
  beforeAll(async () => {
    if (!process.env.TEST_MSSQL_JDBC_URI) {
      throw new Error('You must set a value for process.env.TEST_MSSQL_JDBC_URI. See TESTING.md')
    }
    process.env.TEST_MSSQL_JDBC_URI = process.env.TEST_MSSQL_JDBC_URI.replace(
      'master',
      'referentialActions-onDelete-default',
    )
    await migrateDb({
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()

    await prisma.post.deleteMany()
    await prisma.profile.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
    process.env.TEST_MSSQL_JDBC_URI = baseUri
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

          51 expect(await prisma.user.findMany()).toHaveLength(1)
          52 
          53 try {
        → 54   await prisma.user.delete(
        Foreign key constraint failed on the field: \`Post_authorId_fkey (index)\`
      `)
    }
  })
})
