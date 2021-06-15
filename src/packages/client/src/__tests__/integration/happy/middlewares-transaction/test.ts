import { getTestClient } from '../../../../utils/getTestClient'

describe('middleware and transaction', () => {
  test('next response and params', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()

    let response
    let parameters
    db.$use(async (params, next) => {
      parameters = params
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
      db.user.findMany(),
    ])
    expect(parameters).toMatchInlineSnapshot(`
Object {
  action: findMany,
  args: undefined,
  dataPath: Array [],
  model: User,
  runInTransaction: true,
}
`)
    expect(response.email).toMatchInlineSnapshot(`undefined`)

    await db.user.deleteMany()

    db.$disconnect()
  })
})
