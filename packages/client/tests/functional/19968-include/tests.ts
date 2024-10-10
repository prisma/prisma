import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// See: https://github.com/prisma/prisma/issues/19968
testMatrix.setupTestSuite(
  () => {
    // beforeAll(async () => {
    //   const userIds = Array.from({ length: 10 }).map((_, i) => i + 1)

    //   await prisma.user.createMany({
    //     data: userIds.map((id) => ({ id })),
    //   })

    //   const postIds = Array.from({ length: 40 }).map((_, i) => i + 1).reverse()

    //   await prisma.post.createMany({
    //     data: postIds.map((id) => {
    //       const authorId = Math.max((id / 4) | 0, 1)
    //       console.log('authorId', authorId)

    //       return {
    //         id,
    //         authorId,
    //       }
    //     }),
    //   })

    //   const users = await prisma.user.findMany({})
    //   const posts = await prisma.post.findMany({})

    //   console.log('users', users)
    //   console.log('posts', posts)
    // })

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          id: 1,
        }
      })
      await prisma.user.create({
        data: {
          id: 2
        }
      })
      await prisma.user.create({
        data: {
          id: 10,
        }
      })

      await prisma.post.create({
        data: {
          id: 1,
          userId: 1,
        }
      })
      await prisma.post.create({
        data: {
          id: 2,
          userId: 10,
        }
      })
      await prisma.post.create({
        data: {
          id: 3,
          userId: 2,
        }
      })
      await prisma.post.create({
        data: {
          id: 4,
          userId: 2,
        }
      })

      // delete previously associated user
      await prisma.user.delete({
        where: {
          id: 10,
        }
      })
    })

    test('findMany with include', async () => {
      const result = await prisma.post.findMany({
        include: { user: true },
        // select: {
        //   user: {
        //     select: {
        //       posts: true,
        //     }
        //   }
        // },
        where: {
          id: 2,
        }
      })

      console.log('result', result)
    })
  },
  {
    optOut: {
      from: ['cockroachdb', 'sqlserver', 'sqlite', 'mongodb'],
      reason: 'This issue has been observed on Postgres/MySQL only',
    },
  },
)
