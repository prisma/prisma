import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownMysql } from '../../../../utils/setupMysql'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_MYSQL_URI

describe('referentialActions(mysql)', () => {
  beforeAll(async () => {
    process.env.TEST_MYSQL_URI += '-referentialActions-onDelete-Cascade'
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
    await prisma.$disconnect()
    process.env.TEST_MYSQL_URI = baseUri
  })

  test('delete 1 user, should cascade', async () => {
    await prisma.user.create({
      data: {
        name: 'Alice',
        email: 'alice@prisma.io',
        posts: {
          create: { title: 'Hello World' },
        },
        profile: {
          create: { bio: 'I like turtles' },
        },
      },
    })
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

    expect(await prisma.user.findMany()).toHaveLength(2)
    expect(await prisma.profile.findMany()).toHaveLength(2)
    expect(await prisma.post.findMany()).toHaveLength(2)

    const deleteBob = await prisma.user.delete({
      where: {
        email: 'bob@prisma.io',
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)
    expect(await prisma.profile.findMany()).toHaveLength(1)
    expect(await prisma.post.findMany()).toHaveLength(1)
  })
})
