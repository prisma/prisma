import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
describe('namedConstraints(sqlite) - without preview flag', () => {
  beforeAll(async () => {
    await migrateDb({
      connectionString: `file:./dev.db`,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
  })

  beforeEach(async () => {
    await prisma.atAtUnique.deleteMany()
    await prisma.atAtUniqueNamed.deleteMany()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  test('findUnique using @@unique by default name', async () => {
    await prisma.atAtUnique.create({
      data: {
        key1: 'data',
        key2: 2,
      },
    })
    const result: { key1: string; key2: number } | null =
      await prisma.atAtUnique.findUnique({
        where: {
          key1_key2: {
            key1: 'data',
            key2: 2,
          },
        },
      })
    expect(result).toEqual({
      key1: 'data',
      key2: 2,
    })
  })

  test('findUnique using @@unique by custom name', async () => {
    await prisma.atAtUniqueNamed.create({
      data: {
        key1: 'data',
        key2: 2,
      },
    })
    const result: { key1: string; key2: number } | null =
      await prisma.atAtUniqueNamed.findUnique({
        where: {
          namedConstraintUnique: {
            key1: 'data',
            key2: 2,
          },
        },
      })
    expect(result).toEqual({
      key1: 'data',
      key2: 2,
    })
  })
})
