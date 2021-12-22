import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_MYSQL_URI

describe('referentialActions(mysql, onDelete-SetNull)', () => {
  beforeAll(async () => {
    process.env.TEST_MYSQL_URI += '-referentialActions-onDelete-SetNull'
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
    await prisma.user.deleteMany()
    await prisma.post.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_MYSQL_URI = baseUri
  })

  test('delete 1 user, should set to null in profile', async () => {
    const first = await prisma.user.create({
      data: {
        name: 'Alice',
        email: 'alice@prisma.io',
        posts: {
          create: { title: 'Hello World' },
        },
      },
    })
    const second = await prisma.user.create({
      data: {
        name: 'Bob',
        email: 'bob@prisma.io',
        posts: {
          create: { title: 'Hello Earth' },
        },
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(2)
    expect(await prisma.post.findMany()).toHaveLength(2)
    expect((await prisma.post.findUnique({ where: { id: second.id } })).authorId).not.toEqual(null)

    const deleteBob = await prisma.user.delete({
      where: {
        email: 'bob@prisma.io',
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)
    expect(await prisma.post.findMany()).toHaveLength(2)
    expect((await prisma.post.findUnique({ where: { id: second.id } })).authorId).toEqual(null)
  })
})
