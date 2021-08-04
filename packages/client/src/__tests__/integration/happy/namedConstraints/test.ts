import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
describe('namedConstraint(sqlite)', () => {
  beforeAll(async () => {
    await migrateDb({
      connectionString: `file:./dev.db`,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  afterEach(async () => {
    await prisma.user1.deleteMany()
  })
  afterAll(async () => {
    await prisma.$disconnect()
  })
  test('findUnique using namedConstraint', async () => {
    await prisma.user1.create({
      data: {
        firstName: 'Alice',
        lastName: 'Ball',
      },
    })
    const user = await prisma.user1.findUnique({
      where: {
        customName: {
          firstName: 'Alice',
          lastName: 'Ball',
        },
      },
    })
    expect(user.firstName).toEqual('Alice')
  })
})
