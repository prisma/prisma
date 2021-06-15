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
    ])
    expect(parameters).toMatchInlineSnapshot(`
      Object {
        action: create,
        args: Object {
          data: Object {
            email: test@test.com,
            name: test,
          },
        },
        dataPath: Array [],
        model: User,
        runInTransaction: true,
      }
    `)
    expect(response.email).toMatchInlineSnapshot(`test@test.com`)

    await db.user.deleteMany()

    db.$disconnect()
  })
  test('rollback', async () => {
    const PrismaClient = await getTestClient()
    const db = new PrismaClient()

    let response
    let parameters
    db.$use(async (params, next) => {
      parameters = params
      response = await next(params)

      return response
    })
    try {
      await db.$transaction([
        db.user.create({
          data: {
            email: 'test@test.com',
            name: 'test',
          },
        }),
        db.user.create({
          data: {
            email: 'test@test.com',
            name: 'test',
          },
        }),
      ])
    } catch (e) {
      // TODO Look in to the error handling for transactions
      // expect(e.error_code).toEqual('P2002')
      expect(e).toMatchInlineSnapshot(`
Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: Some(KnownError { message: "Unique constraint failed on the fields: (\`email\`)", meta: Object({"target": Array([String("email")])}), error_code: "P2002" }), kind: UniqueConstraintViolation { constraint: Fields(["email"]) } })
`)
    }
    const users = await db.user.findMany()
    // This should be empty as the transaction should have rolled back
    expect(users).toMatchInlineSnapshot(`Array []`)

    await db.user.deleteMany()

    db.$disconnect()
  })
})
