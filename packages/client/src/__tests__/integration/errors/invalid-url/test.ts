import { generateTestClient } from '../../../../utils/getTestClient'
describe('invalid-url', () => {
  beforeAll(async () => {
    await generateTestClient()
  })
  test('auto-connect', async () => {
    expect.assertions(1)

    const { PrismaClient } = require('@prisma/client')
    const db = new PrismaClient()
    try {
      const posts = await db.user
        .findUnique({
          where: {
            email: 'a@a.de',
          },
        })
        .posts()
    } catch (err) {
      expect(err).toMatchInlineSnapshot(`

        Invalid \`prisma.post.findUnique()\` invocation:


          The provided database string is invalid. The provided arguments are not supported in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
      `)
    }
  })

  test('explicit connect', async () => {
    expect.assertions(1)
    const { PrismaClient } = require('@prisma/client')
    await generateTestClient()
    const db = new PrismaClient()
    try {
      await db.$connect()
    } catch (err) {
      expect(err).toMatchInlineSnapshot(
        `The provided database string is invalid. The provided arguments are not supported in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.`,
      )
    }
  })
})
