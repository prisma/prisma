import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_MYSQL_URI

describe('referentialActions-onDelete-default-foreign-key-error(mysql)', () => {
  beforeAll(async () => {
    process.env.TEST_MYSQL_URI += '-default-onDelete-Cascade'
    await tearDownMysql(process.env.TEST_MYSQL_URI!)
    await migrateDb({
      connectionString: process.env.TEST_MYSQL_URI!,
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
    process.env.TEST_MYSQL_URI = baseUri
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
/client/src/__tests__/integration/errors/referentialActions-onDelete-default-foreign-key-error-mysql/test.ts:47:31

  44 expect(await prisma.user.findMany()).toHaveLength(1)
  45 
  46 try {
→ 47   await prisma.user.delete(
  Foreign key constraint failed on the field: \`authorId\`
`)
    }
  })
})
