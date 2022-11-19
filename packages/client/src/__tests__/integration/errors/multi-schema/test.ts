import { faker } from '@faker-js/faker'

import { generateTestClient } from '../../../../utils/getTestClient'
import type { SetupParams } from '../../../../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../../../../utils/setupPostgres'
// @ts-ignore trick to get typings at dev time
import type { Prisma, PrismaClient } from './node_modules/.prisma/client'

let prisma: PrismaClient
let PrismaUtil: typeof Prisma
const baseUri = process.env.TEST_POSTGRES_URI

const email = faker.internet.email()
const title = faker.name.jobTitle()
const newEmail = faker.internet.email()
const newTitle = faker.name.jobTitle()

describe('multi-schema', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-multi-schema'

    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    const SetupParams: SetupParams = {
      connectionString: process.env.TEST_POSTGRES_URI!,
      dirname: __dirname,
    }
    await setupPostgres(SetupParams).catch((e) => console.error(e))

    await generateTestClient()
    const { PrismaClient, Prisma } = require('./node_modules/.prisma/client')
    prisma = new PrismaClient()
    PrismaUtil = Prisma
  })

  afterAll(async () => {
    await prisma.post.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_POSTGRES_URI = baseUri
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
