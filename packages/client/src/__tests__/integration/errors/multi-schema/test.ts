import { faker } from '@faker-js/faker'

import { generateTestClient } from '../../../../utils/getTestClient'
import type { SetupParams } from '../../../../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../../../../utils/setupPostgres'
// @ts-ignore trick to get typings at dev time
import type { PrismaClient } from './node_modules/.prisma/client'

let prisma: PrismaClient

const email = faker.internet.email()
const title = faker.person.jobTitle()
const newEmail = faker.internet.email()
const newTitle = faker.person.jobTitle()

describe('multischema', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_POSTGRES_URI!.replace('tests', 'tests-multischema')
    await tearDownPostgres(process.env.DATABASE_URL)
    const SetupParams: SetupParams = {
      connectionString: process.env.DATABASE_URL,
      dirname: __dirname,
    }
    await setupPostgres(SetupParams).catch((e) => console.error(e))

    await generateTestClient()
    const { PrismaClient } = require('./node_modules/.prisma/client')
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.post.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('create', async () => {
    const created = await prisma.user.create({
      data: {
        email,
        posts: {
          create: [{ title }],
        },
      },
      select: {
        email: true,
        posts: true,
      },
    })

    expect(created).toMatchObject({
      email,
      posts: [{ title }],
    })
  })

  test('read', async () => {
    const [read] = await prisma.user.findMany({
      where: {
        email,
        posts: {
          some: {
            title,
          },
        },
      },
      select: {
        email: true,
        posts: true,
      },
    })

    expect(read).toMatchObject({
      email,
      posts: [{ title }],
    })
  })

  test('update', async () => {
    await prisma.post.updateMany({
      where: {
        title,
      },
      data: { title: newTitle },
    })

    await prisma.user.updateMany({
      where: {
        email,
      },
      data: { email: newEmail },
    })

    const [read] = await prisma.user.findMany({
      where: {
        email: newEmail,
        posts: {
          some: {
            title: newTitle,
          },
        },
      },
      select: {
        email: true,
        posts: true,
      },
    })

    expect(read).toMatchObject({
      email: newEmail,
      posts: [{ title: newTitle }],
    })
  })

  test('delete', async () => {
    await prisma.post.deleteMany({
      where: {
        title: newTitle,
      },
    })

    await prisma.user.deleteMany({
      where: {
        email: newEmail,
      },
    })

    expect(
      await prisma.post.findMany({
        where: {
          title: newTitle,
        },
      }),
    ).toHaveLength(0)

    expect(
      await prisma.user.findMany({
        where: {
          email: newEmail,
        },
      }),
    ).toHaveLength(0)
  })
})
