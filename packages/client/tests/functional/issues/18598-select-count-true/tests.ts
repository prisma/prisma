import { AdapterProviders } from '../../_utils/providers'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  () => {
    beforeAll(async () => {
      const { id } = await prisma.user.create({ data: {} })

      await prisma.post.create({ data: { user: { connect: { id } } } })
      await prisma.post.create({ data: { user: { connect: { id } } } })
    })

    test('works with _count shorthand', async () => {
      const user = await prisma.user.findFirst({
        select: {
          _count: true,
        },
      })

      expect(user?._count).toEqual({
        posts: 2,
      })
    })
  },
  {
    skipDriverAdapter: {
      from: [AdapterProviders.JS_LIBSQL],
      reason: 'js_libsql: SIGABRT due to panic in libsql (not yet implemented: array)', // TODO: ORM-867
    },
  },
)
