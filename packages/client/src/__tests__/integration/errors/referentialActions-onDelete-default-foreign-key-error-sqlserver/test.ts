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
/client/src/__tests__/integration/errors/default-onDelete-cascade-sqlserver/test.ts:41:31

  38 expect(await prisma.user.findMany()).toHaveLength(1)
  39 
  40 try {
→ 41   await prisma.user.delete(
  The change you are trying to make would violate the required relation 'PostToUser' between the \`Post\` and \`User\` models.
`)
    }
  })
})
