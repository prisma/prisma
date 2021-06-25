import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
describe('default-onDelete-cascade(sqlite)', () => {
  beforeAll(async () => {
    await migrateDb({
      connectionString: `file:./dev.db`,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.post.deleteMany()
    await prisma.profile.deleteMany()
    await prisma.user.deleteMany()
    await prisma.$disconnect()
  })

  test('delete 1 user, should error', async () => {
    await prisma.user.create({
      data: {
        name: 'Bob',
        email: 'bob@prisma.io',
        posts: {
          create: { title: 'Hello Earth' },
        },
        profile: {
          create: { bio: 'I like pinguins' },
        },
      },
    })

    expect(await prisma.user.findMany()).toHaveLength(1)

    try {
      await prisma.user.delete({
        where: {
          email: 'bob@prisma.io',
        },
      })
    } catch (e) {
      expect(e.message).toMatchInlineSnapshot(`

Invalid \`prisma.user.delete()\` invocation:


  Error occurred during query execution:
ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(SqliteFailure(Error { code: ConstraintViolation, extended_code: 1811 }, Some("FOREIGN KEY constraint failed"))) })
`)
    }
  })
})
