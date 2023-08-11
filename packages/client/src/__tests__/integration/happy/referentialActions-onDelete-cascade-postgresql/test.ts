import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_POSTGRES_URI

describe('referentialActions(postgresql)', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-referentialActions-onDelete-Cascade'
    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    await migrateDb({
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_POSTGRES_URI = baseUri
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
          create: { bio: 'I like penguins' },
        },
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(2)
    expect(await prisma.profile.findMany()).toHaveLength(2)
    expect(await prisma.post.findMany()).toHaveLength(2)

    await prisma.user.delete({
      where: {
        email: 'bob@prisma.io',
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)
    expect(await prisma.profile.findMany()).toHaveLength(1)
    expect(await prisma.post.findMany()).toHaveLength(1)
  })
})
