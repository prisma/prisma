import { getTestClient } from '../../../../utils/getTestClient'
describe('prisma promises', () => {
  /**
   * Requests must get sent if we call `.catch`
   */
  test('catch', async () => {
    const PrismaClient = await getTestClient()
    const prisma = new PrismaClient()
    const catcher = (e) => Promise.reject(e)

    const remove = await prisma.user.deleteMany().catch(catcher)
    const queryRaw = await prisma.$queryRaw('SELECT 1').catch(catcher)
    const executeRaw = await prisma
      .$executeRaw('DELETE FROM User')
      .catch(catcher)
    const findMany = await prisma.user.findMany().catch(catcher)

    expect(remove).toMatchInlineSnapshot(`
      Object {
        count: 0,
      }
    `)
    expect(queryRaw).toMatchInlineSnapshot(`
      Array [
        Object {
          1: 1,
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
    const catcher = (e) => Promise.reject(e)

    const remove = await prisma.user.deleteMany().finally(catcher)
    const queryRaw = await prisma.$queryRaw('SELECT 1').finally(catcher)
    const executeRaw = await prisma
      .$executeRaw('DELETE FROM User')
      .finally(catcher)
    const findMany = await prisma.user.findMany().finally(catcher)

    expect(remove).toMatchInlineSnapshot(`
        Object {
          count: 0,
        }
      `)
    expect(queryRaw).toMatchInlineSnapshot(`
        Array [
          Object {
            1: 1,
          },
        ]
      `)
    expect(executeRaw).toMatchInlineSnapshot(`0`)
    expect(findMany).toMatchInlineSnapshot(`Array []`)

    await prisma.$disconnect()
  })
})
