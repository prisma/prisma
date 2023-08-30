import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'
import { tearDownPostgres } from '../../../../utils/setupPostgres'
import { migrateDb } from '../../__helpers__/migrateDb'
// @ts-ignore trick to get typings at dev time
import type { Prisma, PrismaClient } from './node_modules/.prisma/client'

let prisma: PrismaClient
let PrismaUtil: typeof Prisma
const baseUri = process.env.TEST_POSTGRES_URI

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(100_000)
}

describe('json-filtering(postgres)', () => {
  beforeAll(async () => {
    process.env.TEST_POSTGRES_URI += '-json-filtering'
    await tearDownPostgres(process.env.TEST_POSTGRES_URI!)
    await migrateDb({
      schemaPath: path.join(__dirname, 'schema.prisma'),
    })
    await generateTestClient()
    const { PrismaClient, Prisma } = require('./node_modules/.prisma/client')
    prisma = new PrismaClient()
    PrismaUtil = Prisma
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
          jsonOpt: undefined,
        },
        {
          email: 'b@b.de',
          json: {
            string: 'bc',
            number: 2,
            array: [5, 6, 7, 8],
            object: { a: 4, b: 5, c: 6 },
          },
          jsonOpt: PrismaUtil.JsonNull,
        },
        {
          email: 'c@b.de',
          json: {
            string: 'cd',
            number: 3,
            array: [9, 10, 11, 12],
            object: { a: 7, b: 8, c: 9 },
          },
          jsonOpt: PrismaUtil.DbNull,
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

  /**
   * Filter entries that have a JSON `null` value
   */
  test('filter with Prisma.JsonNull', async () => {
    const data = await prisma.user.findMany({
      where: {
        jsonOpt: {
          equals: PrismaUtil.JsonNull,
        },
      },
      select: {
        json: true,
      },
    })

    expect(sort(data)).toMatchSnapshot()
  })

  /**
   * Filter entries that have a db `null` value
   */
  test('filter with Prisma.DbNull', async () => {
    const data = await prisma.user.findMany({
      where: {
        jsonOpt: {
          equals: PrismaUtil.DbNull,
        },
      },
      select: {
        json: true,
      },
    })

    expect(sort(data)).toMatchSnapshot()
  })

  /**
   * Filter entries that have a db or json `null` value
   */
  test('filter with Prisma.AnyNull', async () => {
    const data = await prisma.user.findMany({
      where: {
        jsonOpt: {
          equals: PrismaUtil.AnyNull,
        },
      },
      select: {
        json: true,
      },
    })

    expect(sort(data)).toMatchSnapshot()
  })
})

function sort(array: any) {
  return array.sort((a, b) => b.json.number - a.json.number)
}
