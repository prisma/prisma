import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for issue #8612
 * Optimistic concurrency control (OCC)
 */
testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.resource.create({ data: {} })
    })

    afterEach(async () => {
      await prisma.resource.deleteMany()
    })

    test('updateMany', async () => {
      const fn = async () => {
        // we get our concurrent resource at some point in time
        const resource = (await prisma.resource.findFirst())!

        // at this stage, the occStamp is always equal to `0`
        expect(resource).toMatchObject({ occStamp: 0 })

        // for this resource, we tell the database to update it
        await prisma.resource.updateMany({
          where: { occStamp: resource.occStamp },
          data: { occStamp: { increment: 1 } },
        })
        // if the occStamp changed between the findFirst and the
        // updateMany, the updateMany will not update anything

        // 🛑 but the query engine ignores that at the moment
      }

      // so we want to fire 5 requests in parallel that are OCCed
      await Promise.allSettled([fn(), fn(), fn(), fn(), fn()])

      // if OCC worked correctly, then the occStamp should be `1`
      // because our where clause specified to ONLY update if `0`

      // this shows that the update query engine query is not atomic
      expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
    })

    test('update', async () => {
      const fn = async () => {
        const resource = (await prisma.resource.findFirst())!

        expect(resource).toMatchObject({ occStamp: 0 })

        await prisma.resource.update({
          where: { occStamp: resource.occStamp },
          data: { occStamp: { increment: 1 } },
        })
      }

      await Promise.allSettled([fn(), fn(), fn(), fn(), fn()])

      expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
    })

    test('deleteMany', async () => {
      const fn = async (): Promise<number> => {
        const result = await prisma.resource.deleteMany({
          where: { occStamp: 0 },
        })

        return result.count
      }

      const results = await Promise.all([fn(), fn(), fn(), fn(), fn()])
      const totalCount = results.reduce((acc, result) => acc + result, 0)

      expect(totalCount).toBe(1)
    })

    test('upsert', async () => {
      const fn = async () => {
        const resource = (await prisma.resource.findFirst())!

        expect(resource).toMatchObject({ occStamp: 0 })

        await prisma.resource.upsert({
          where: { occStamp: resource.occStamp },
          update: { occStamp: { increment: 1 } },
          create: {},
        })
      }

      await Promise.allSettled([fn(), fn(), fn(), fn(), fn()])

      expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
    })
  },
  {
    // skipDefaultClientInstance: true,
    // optOut: {
    //   from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver'],
    //   reason: 'sqlserver fails but is flaky and sqlite/mongodb/cockroachdb have no issues',
    // },
  },
)
