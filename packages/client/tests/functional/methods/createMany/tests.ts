import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should create many records', async () => {
      const email1 = faker.internet.email()
      const email2 = faker.internet.email()
      const email3 = faker.internet.email()
      const email4 = faker.internet.email()

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
      const email = faker.internet.email()
      const name = faker.person.firstName()
      const title = faker.person.firstName()

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
      const email = faker.internet.email()
      const name = faker.person.firstName()
      const title1 = faker.person.firstName()
      const title2 = faker.person.firstName()
      const title3 = faker.person.firstName()
      const title4 = faker.person.firstName()

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
    skipDriverAdapter: {
      from: ['js_d1'],
      reason:
        'D1 driver adapter does not return the correct number of created records. See https://github.com/prisma/team-orm/issues/1069',
    },
  },
)
