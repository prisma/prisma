import { copycat } from '@snaplet/copycat'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should create many records', async () => {
      const email1 = copycat.email(32)
      const email2 = copycat.email(65)
      const email3 = copycat.email(38)
      const email4 = copycat.email(47)

      const created = await prisma.user.createMany({
        data: [
          {
            email: email1,
          },
          {
            email: email2,
          },
          {
            email: email3,
          },
          {
            email: email4,
          },
        ],
      })

      expect(created.count).toEqual(4)
    })

    test('should create a single record with a single nested create', async () => {
      const email = copycat.email(45)
      const name = copycat.firstName(62)
      const title = copycat.firstName(97)

      const res = await prisma.user.create({
        include: {
          posts: true,
        },
        data: {
          name,
          email,
          posts: {
            createMany: {
              data: {
                title,
              },
            },
          },
        },
      })

      expect(res.email).toEqual(email)
      expect(res.name).toEqual(name)
      expect(res.posts.length).toEqual(1)
      expect(res.posts[0].title).toEqual(title)
    })

    test('should create a single record with many nested create', async () => {
      const email = copycat.email(19)
      const name = copycat.firstName(28)
      const title1 = copycat.firstName(63)
      const title2 = copycat.firstName(47)
      const title3 = copycat.firstName(50)
      const title4 = copycat.firstName(60)

      const res = await prisma.user.create({
        include: {
          posts: true,
        },
        data: {
          name,
          email,
          posts: {
            createMany: {
              data: [{ title: title1 }, { title: title2 }, { title: title3 }, { title: title4 }],
            },
          },
        },
      })

      expect(res.email).toEqual(email)
      expect(res.name).toEqual(name)
      expect(res.posts.length).toEqual(4)

      const post1 = res.posts.find((p) => p.title === title1)
      expect(post1).toBeTruthy()

      const post2 = res.posts.find((p) => p.title === title2)
      expect(post2).toBeTruthy()

      const post3 = res.posts.find((p) => p.title === title3)
      expect(post3).toBeTruthy()

      const post4 = res.posts.find((p) => p.title === title4)
      expect(post4).toBeTruthy()
    })
  },
  {
    optOut: {
      from: ['sqlite'],
      reason: 'createMany not supported by sqlite',
    },
  },
)
