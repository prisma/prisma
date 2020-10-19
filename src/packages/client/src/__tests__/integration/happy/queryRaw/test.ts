import sql from 'sql-template-tag'
import { getTestClient } from '../../../../utils/getTestClient'

describe('queryRaw: mysql datasource', () => {
  let prisma

  beforeEach(async () => {
    const PrismaClient = await getTestClient()
    prisma = new PrismaClient()
  })

  afterEach(async () => {
    await prisma.$disconnect()
  })

  test('$queryRaw as a tagged template literal call', async () => {
    const email = 'a@a.de'
    const user = await prisma.$queryRaw`SELECT * FROM User WHERE email = ${email}`

    expect(user).toMatchInlineSnapshot(`
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ]
    `)
  })

  test('$queryRaw as a method call', async () => {
    const email = 'a@a.de'
    const user = await prisma.$queryRaw(
      `SELECT * FROM User WHERE email = ?`,
      email,
    )
    expect(user).toMatchInlineSnapshot(`
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ]
    `)
  })

  test('$queryRaw as a method call with sql-template-tag', async () => {
    const email = 'a@a.de'
    const user = await prisma.$queryRaw(
      sql`SELECT * FROM User WHERE email = ${email}`,
    )
    expect(user).toMatchInlineSnapshot(`
      Array [
        Object {
          email: a@a.de,
          id: 576eddf9-2434-421f-9a86-58bede16fd95,
          name: Alice,
        },
      ]
    `)
  })
})
