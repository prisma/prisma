import { faker } from '@faker-js/faker'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(() => {
  test('should create a user and update that field on that user', async () => {
    const email = faker.internet.email()
    const name = faker.name.firstName()
    const newEmail = faker.internet.email()

    await prisma.user.create({
      data: {
        email,
        name,
      },
    })

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    const response = await prisma.user.update({
      where: {
        id: user?.id as string,
      },
      select: {
        email: true,
      },
      data: {
        email: newEmail,
      },
    })

    expect(response.email).toEqual(newEmail)
  })

  test('should create a user and post and connect them together', async () => {
    const email = faker.internet.email()
    const name = faker.name.firstName()
    const title = faker.lorem.slug()
    const published = true

    const user = await prisma.user.create({
      data: {
        email,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })

    const post = await prisma.post.create({
      data: {
        title,
        published,
      },
      select: {
        id: true,
        title: true,
        published: true,
      },
    })

    const response = await prisma.user.update({
      where: {
        id: user?.id as string,
      },
      select: {
        id: true,
        name: true,
        email: true,
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
          },
        },
      },
      data: {
        posts: {
          connect: {
            id: post!.id,
          },
        },
      },
    })

    expect(response).toMatchObject({
      ...user,
      posts: [post],
    })
  })

  test('should create a user and post and disconnect them', async () => {
    const email = faker.internet.email()
    const name = faker.name.firstName()
    const title = faker.lorem.slug()
    const published = true

    const user = await prisma.user.create({
      data: {
        email,
        name,
        posts: {
          create: [
            {
              title,
              published,
            },
          ],
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
          },
        },
      },
    })

    const response = await prisma.user.update({
      where: {
        id: user?.id as string,
      },
      select: {
        id: true,
        name: true,
        email: true,
        posts: {
          select: {
            id: true,
            title: true,
            published: true,
          },
        },
      },
      data: {
        posts: {
          disconnect: {
            id: user!.posts![0]!.id ,
          },
        },
      },
    })

    expect(response).toMatchObject({
      ...user,
      posts: [],
    })
  })

  test('should create a user with posts and a profile and update itself and nested connections setting fields to null', async () => {
    const someDate = new Date('2020-01-01T00:00:00.348Z')
    const email = faker.internet.email()
    const name = faker.name.firstName()
    const newEmail = faker.internet.email()
    const title = faker.lorem.slug()
    const content = faker.lorem.sentence()
    const optional = faker.lorem.sentence()
    const bio = faker.lorem.sentence()
    const notrequired = faker.lorem.word()

    await prisma.user.create({
      data: {
        email,
        name,
        wakesUpAt: someDate,
        lastLoginAt: someDate,
        posts: {
          create: new Array(5).fill(undefined).map(() => ({
            published: true,
            title,
            content,
            optional,
            lastReviewedAt: someDate,
            lastPublishedAt: someDate,
          })),
        },
        profile: {
          create: {
            bio,
            notrequired,
            goesToBedAt: someDate,
            goesToOfficeAt: someDate,
          },
        },
      },
    })

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    })

    const response = await prisma.user.update({
      where: {
        id: user?.id as string,
      },
      select: {
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
        email: newEmail,
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

    expect(response.email).toEqual(newEmail)
    expect(response.name).toEqual(null)
    expect(response.lastLoginAt).toEqual(null)
    expect(response.wakesUpAt).toEqual(null)

    response.posts.forEach((post) => {
      expect(post).toMatchObject({
        content: null,
        optional: null,
        published: true,
        title,
      })
    })

    expect(response.profile).toMatchObject({
      bio: null,
      goesToBedAt: null,
    })
  })
})
