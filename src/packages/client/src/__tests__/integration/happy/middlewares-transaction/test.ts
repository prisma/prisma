import { getTestClient } from '../../../../utils/getTestClient'

describe('middleware and transaction', () => {
  test('typeof next reponse', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()

    let response
    db.$use(async (params, next) => {
      response = await next(params)

      return response
    })

    await db.$transaction([
      db.user.create({
        data: {
          email: 'test@test.com',
          name: 'test',
        },
      }),
    ])

    expect(response.email).toMatchInlineSnapshot(`test@test.com`)

    await db.user.deleteMany()

    db.$disconnect()
  })
})
