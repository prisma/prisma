import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

// https://github.com/prisma/prisma/issues/11974
testMatrix.setupTestSuite(
  () => {
    test('should not throw an error when counting two relation fields', async () => {
      await prisma.comment.create({
        data: {
          id: '1',
          downVotedUsers: {
            create: { uid: '2' },
          },
          upVotedUsers: {
            create: {
              uid: '3',
            },
          },
        },
      })

      const response = await prisma.comment.findMany({
        include: {
          _count: {
            select: {
              upVotedUsers: true,
              downVotedUsers: true,
            },
          },
        },
      })

      expect(response).toMatchObject([{ id: '1', _count: { upVotedUsers: 1, downVotedUsers: 1 } }])
    })
  },
  { optOut: { from: ['mongodb'], reason: 'Implicit relations are not supported in MongoDB' } },
)
