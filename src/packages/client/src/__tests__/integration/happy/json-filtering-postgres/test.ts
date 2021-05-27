import path from 'path'
import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'

let prisma
const baseUri = process.env.TEST_POSTGRES_URI
describe('json-filtering(postgres)', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-json-filtering'
    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    await migrateDb({
      connectionString: process.env.TEST_POSTGRES_URI!,
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient } = require('./node_modules/@prisma/client')
    prisma = new PrismaClient()
    await prisma.user.createMany({
      data: [
        {
          email: 'a@b.de',
          json: {
            string: 'ab',
            number: 1,
            array: [1, 2, 3, 4],
            object: { a: 1, b: 2, c: 3 },
          },
        },
        {
          email: 'b@b.de',
          json: {
            string: 'bc',
            number: 2,
            array: [5, 6, 7, 8],
            object: { a: 4, b: 5, c: 6 },
          },
        },
        {
          email: 'c@b.de',
          json: {
            string: 'cd',
            number: 3,
            array: [9, 10, 11, 12],
            object: { a: 7, b: 8, c: 9 },
          },
        },
      ],
    })
  })
  afterAll(async () => {
    await prisma.user.deleteMany()
    await prisma.$disconnect()
    process.env.TEST_POSTGRES_URI = baseUri
  })

  test('lt(2)', async () => {
    const a = await prisma.user.findMany({
      where: {
        json: {
          path: ['number'],
          lt: 2,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(a)).toMatchSnapshot()

    // Nested Object
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['object', 'a'],
          lt: 2,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('lte(2)', async () => {
    const a = await prisma.user.findMany({
      where: {
        json: {
          path: ['number'],
          lte: 2,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(a)).toMatchSnapshot()
  })
  test('gte(2)', async () => {
    const a = await prisma.user.findMany({
      where: {
        json: {
          path: ['number'],
          gte: 2,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(a)).toMatchSnapshot()
  })
  test('gt(2)', async () => {
    const a = await prisma.user.findMany({
      where: {
        json: {
          path: ['number'],
          gt: 2,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(a)).toMatchSnapshot()
  })
  test('string_contains(bc)', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['string'],
          string_contains: 'bc',
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('string_starts_with(a)', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['string'],
          string_starts_with: 'a',
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('string_ends_with(c)', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['string'],
          string_ends_with: 'c',
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('array_contains([1, 2, 3])', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['array'],
          array_contains: [1, 2, 3],
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('array_starts_with(5)', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['array'],
          array_starts_with: 5,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
  test('array_ends_with(12)', async () => {
    const b = await prisma.user.findMany({
      where: {
        json: {
          path: ['array'],
          array_ends_with: 12,
        },
      },
      select: {
        json: true,
      },
    })
    expect(sort(b)).toMatchSnapshot()
  })
})
function sort(array: any) {
  return array.sort((a, b) => b.json.number - a.json.number)
}
