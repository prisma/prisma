import { getTestClient } from '../../../../utils/getTestClient'

describe('prisma promises', () => {
  /**
   * Requests must get sent if we call `.catch`
   */
  test('catch', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient()
    const handler = (e) => Promise.reject(e)

    const remove = await prisma.user.deleteMany().catch(handler)
    const queryRaw = await prisma.$queryRawUnsafe('SELECT 1').catch(handler)
    const executeRaw = await prisma.$executeRawUnsafe('DELETE FROM User').catch(handler)
    const findMany = await prisma.user.findMany().catch(handler)

    expect(remove).toMatchInlineSnapshot(`
      Object {
        count: 0,
      }
    `)
    expect(queryRaw).toMatchInlineSnapshot(`
      Array [
        Object {
          1: 1n,
        },
      ]
    `)
    expect(executeRaw).toMatchInlineSnapshot(`0`)
    expect(findMany).toMatchInlineSnapshot(`Array []`)

    await prisma.$disconnect()
  })

  /**
   * Requests must get sent if we call `.finally`
   */
  test('finally', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient()
    const handler = () => {}

    const remove = await prisma.user.deleteMany().finally(handler)
    const queryRaw = await prisma.$queryRawUnsafe('SELECT 1').finally(handler)
    const executeRaw = await prisma.$executeRawUnsafe('DELETE FROM User').finally(handler)
    const findMany = await prisma.user.findMany().finally(handler)

    expect(remove).toMatchInlineSnapshot(`
        Object {
          count: 0,
        }
      `)
    expect(queryRaw).toMatchInlineSnapshot(`
        Array [
          Object {
            1: 1n,
          },
        ]
      `)
    expect(executeRaw).toMatchInlineSnapshot(`0`)
    expect(findMany).toMatchInlineSnapshot(`Array []`)

    await prisma.$disconnect()
  })
})
