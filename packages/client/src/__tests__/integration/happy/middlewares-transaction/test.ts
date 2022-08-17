import { generateTestClient } from '../../../../utils/getTestClient'

describe('middleware and transaction', () => {
  test('typeof await next()', async () => {
    await generateTestClient()
    const PrismaClient = require('./node_modules/@prisma/client').PrismaClient

    const prisma = new PrismaClient()
    await prisma.user.deleteMany()

    const responses: any[] = []
    prisma.$use(async (params, next) => {
      const response = await next(params)
      responses.push(response)
      return response
    })

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'test@test.com',
          name: 'test',
        },
      }),
    ])
    expect(typeof responses[0]).toEqual(`object`)
    expect(responses[0].email).toMatchInlineSnapshot(`test@test.com`)

    const users = await prisma.user.findMany()
    expect(users[0].email).toMatchInlineSnapshot(`test@test.com`)

    await prisma.user.deleteMany()

    prisma.$disconnect()
  })
})
