import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('./node_modules/@prisma/client').PrismaClient
declare let newPrismaClient: NewPrismaClient<typeof import('./node_modules/@prisma/client').PrismaClient>

/**
 * Regression test for issue #8612
 * Optimistic concurrency control (OCC)
 */
testMatrix.setupTestSuite((suiteConfig, suiteMeta) => {
  beforeEach(async () => {
    await prisma.resource.createMany({
      data: [{}], // one is enough
    })
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
    await Promise.all([fn(), fn(), fn(), fn(), fn()])

    // if OCC worked correctly, then the occStamp should be `1`
    // because our where clause clearly specified to update if `0`

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

    await Promise.all([fn(), fn(), fn(), fn(), fn()])

    expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
  })

  test('deleteMany', async () => {
    const fn = async () => {
      const resource = (await prisma.resource.findFirst())!

      expect(resource).toMatchObject({ occStamp: 0 })

      const _update = prisma.resource.updateMany({
        where: { occStamp: resource.occStamp },
        data: { occStamp: { increment: 1 } },
      })

      // with OCC working, this should have had no effect
      const _delete = prisma.resource.deleteMany({
        where: { occStamp: resource.occStamp },
      })

      // sending requests in parallel but with update first
      await Promise.allSettled([_update, _delete])
    }

    await Promise.all([fn(), fn(), fn(), fn(), fn()])

    expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
  })

  test('delete', async () => {
    const fn = async () => {
      const resource = (await prisma.resource.findFirst())!

      expect(resource).toMatchObject({ occStamp: 0 })

      const _update = prisma.resource.update({
        where: { occStamp: resource.occStamp },
        data: { occStamp: { increment: 1 } },
      })

      // with OCC working, this should have had no effect
      const _delete = prisma.resource.delete({
        where: { occStamp: resource.occStamp },
      })

      // sending requests in parallel but with update first
      await Promise.allSettled([_update, _delete])
    }

    await Promise.all([fn(), fn(), fn(), fn(), fn()])

    expect(await prisma.resource.findFirst()).toMatchObject({ occStamp: 1 })
  })
})
