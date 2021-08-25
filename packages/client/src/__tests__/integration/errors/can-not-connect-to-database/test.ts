import { generateTestClient } from '../../../../utils/getTestClient'

let prisma

describe('can-not-connect-to-database', () => {
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

Invalid \`prisma.user.findUnique()\` invocation:


  Can't reach database server at \`localhost\`:\`5444\`

Please make sure your database server is running at \`localhost\`:\`5444\`.
`)
    }
  })

  test('explicit connect', async () => {
    expect.assertions(1)
    try {
      await prisma.$connect()
    } catch (err) {
      expect(err).toMatchInlineSnapshot(`
  Can't reach database server at \`localhost\`:\`5444\`
  
  Please make sure your database server is running at \`localhost\`:\`5444\`.
  `)
    }
  })
})
