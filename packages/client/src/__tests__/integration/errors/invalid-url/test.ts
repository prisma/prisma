import { generateTestClient } from '../../../../utils/getTestClient'

let prisma

describe('invalid-url', () => {
  beforeAll(async () => {
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  test('auto-connect', async () => {
    expect.assertions(1)

    try {
      await prisma.user.findUnique({
        where: {
          email: 'a@a.de',
        },
      })
    } catch (err) {
      expect(err).toMatchInlineSnapshot(`

        Invalid \`prisma.user.findUnique()\` invocation in
        /client/src/__tests__/integration/errors/invalid-url/test.ts:0:0

          13 expect.assertions(1)
          14 
          15 try {
        → 16   await prisma.user.findUnique(
        The provided database string is invalid. The provided arguments are not supported in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.
      `)
    }
  })

  test('explicit connect', async () => {
    expect.assertions(1)
    try {
      await prisma.$connect()
    } catch (err) {
      expect(err).toMatchInlineSnapshot(
        `The provided database string is invalid. The provided arguments are not supported in database URL. Please refer to the documentation in https://www.prisma.io/docs/reference/database-reference/connection-urls for constructing a correct connection string. In some cases, certain characters must be escaped. Please check the string for any illegal characters.`,
      )
    }
  })
})
