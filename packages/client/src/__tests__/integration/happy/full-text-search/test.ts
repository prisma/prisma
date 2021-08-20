import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_POSTGRES_URI
describe('full-text-search (postgres)', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-full-text-search'
    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    await migrateDb({
      connectionString: process.env.TEST_POSTGRES_URI!,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient(__dirname)
    // const { PrismaClient } = require('./node_modules/@prisma/client')
    // prisma = new PrismaClient()
  })
  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_POSTGRES_URI = baseUri
  })

  test('lt(2)', async () => {})
})
function sort(array: any) {
  return array.sort((a, b) => b.json.number - a.json.number)
}
