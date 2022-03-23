import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

import { getTestClient } from '../../../../utils/getTestClient'

const copyFile = promisify(fs.copyFile)

test('blog-update', async () => {
  await copyFile(path.join(__dirname, 'dev.db'), path.join(__dirname, 'dev-tmp.db'))

  const PrismaClient = await getTestClient()
  const prisma = new PrismaClient()

  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()

  const someDate = new Date('2020-01-01T00:00:00.348Z')

  await prisma.user.create({
    data: {
      email: `a@hey.com`,
      name: `Bob`,
      wakesUpAt: someDate,
      lastLoginAt: someDate,
      posts: {
        create: new Array(5).fill(undefined).map(() => ({
          published: true,
          title: 'mytitle',
          content: 'somecontent',
          optional: 'optional',
          lastReviewedAt: someDate,
          lastPublishedAt: someDate,
        })),
      },
      profile: {
        create: {
          bio: 'something',
          notrequired: 'hello',
          goesToBedAt: someDate,
          goesToOfficeAt: someDate,
        },
      },
    },
  })

  const user = await prisma.user.findUnique({
    where: {
      email: `a@hey.com`,
    },
  })

  const updateNullResult = await prisma.user.update({
    where: {
      id: user.id,
    },
    select: {
      // id: true,
      email: true,
      name: true,
      wakesUpAt: true,
      lastLoginAt: true,
      profile: {
        select: {
          bio: true,
          goesToBedAt: true,
        },
      },
      posts: {
        select: {
          content: true,
          title: true,
          published: true,
          optional: true,
        },
      },
    },
    data: {
      name: null,
      wakesUpAt: null,
      lastLoginAt: {
        set: null,
      },
      profile: {
        update: {
          notrequired: null,
          bio: {
            set: null,
          },
          goesToBedAt: null,
          goesToOfficeAt: {
            set: null,
          },
        },
      },
      posts: {
        updateMany: {
          data: {
            content: null,
            optional: {
              set: null,
            },
            lastReviewedAt: null,
            lastPublishedAt: {
              set: null,
            },
          },
          where: {},
        },
      },
    },
  })

  expect(updateNullResult).toMatchInlineSnapshot(`
    Object {
      email: a@hey.com,
      lastLoginAt: null,
      name: null,
      posts: Array [
        Object {
          content: null,
          optional: null,
          published: true,
          title: mytitle,
        },
        Object {
          content: null,
          optional: null,
          published: true,
          title: mytitle,
        },
        Object {
          content: null,
          optional: null,
          published: true,
          title: mytitle,
        },
        Object {
          content: null,
          optional: null,
          published: true,
          title: mytitle,
        },
        Object {
          content: null,
          optional: null,
          published: true,
          title: mytitle,
        },
      ],
      profile: Object {
        bio: null,
        goesToBedAt: null,
      },
      wakesUpAt: null,
    }
  `)

  await prisma.profile.deleteMany()
  await prisma.user.deleteMany()
  await prisma.post.deleteMany()

  await prisma.$disconnect()
})
