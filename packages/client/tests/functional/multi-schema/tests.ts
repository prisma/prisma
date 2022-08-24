import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    const email = faker.internet.email()
    const title = faker.name.jobTitle()

    const newEmail = faker.internet.email()
    const newTitle = faker.name.jobTitle()

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

      const found = await prisma.user.findMany({
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

      expect(found).toHaveLength(0)
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'mysql', 'cockroachdb'],
      reason: 'Multi Schema only working for postgresql and sqlserver',
    },
  },
)
