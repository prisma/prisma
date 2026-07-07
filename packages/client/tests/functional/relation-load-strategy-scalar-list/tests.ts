import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient<'query'>

// Regression test for https://github.com/prisma/prisma/issues/28349.
//
// Under `relationLoadStrategy: "join"` the query compiler `::text`-casts scalar
// list columns whose element type can't be represented in JSON without loss of
// precision (`BigInt[]`, `Decimal[]`) into the aggregated JSON object, so they
// arrive at the client as a PostgreSQL array literal string (e.g. `"{1,2}"`).
// The list deserializer used to call `.map` on that string and throw
// `TypeError: <x>.map is not a function`. `strs` (`String[]`) and `ints`
// (`Int[]`) are embedded natively and act as controls. The `query` strategy was
// never affected, so running the whole suite under both strategies also asserts
// parity between them.
testMatrix.setupTestSuite(
  (suiteConfig, _suiteMeta, _clientMeta, cliMeta) => {
    const relationJoinsEnabled = cliMeta.previewFeatures.includes('relationJoins')

    describeIf(relationJoinsEnabled)('scalar lists under relationLoadStrategy', () => {
      const relationLoadStrategy = suiteConfig.strategy as PrismaNamespace.RelationLoadStrategy

      beforeAll(async () => {
        await prisma.author.create({
          data: {
            name: 'Ada',
            books: {
              create: {
                title: 'b1',
                tags: [1n, 2n],
                prices: ['1.5', '2.25'],
                strs: ['x', 'y'],
                ints: [7, 8],
              },
            },
          },
        })
      })

      test('hydrates BigInt[] / Decimal[] child scalar lists when the relation is loaded via `include`', async () => {
        const author = await prisma.author.findFirstOrThrow({
          include: { books: true },
          relationLoadStrategy,
        })

        expect(Array.isArray(author.books)).toBe(true)
        const [book] = author.books
        expect(book.tags).toEqual([1n, 2n])
        expect(book.prices.map((p) => p.toString())).toEqual(['1.5', '2.25'])
        expect(book.strs).toEqual(['x', 'y'])
        expect(book.ints).toEqual([7, 8])
      })

      test('hydrates a BigInt[] child scalar list when selected via nested `select`', async () => {
        const author = await prisma.author.findFirstOrThrow({
          select: { books: { select: { id: true, tags: true } } },
          relationLoadStrategy,
        })

        expect(Array.isArray(author.books)).toBe(true)
        expect(author.books[0].tags).toEqual([1n, 2n])
      })
    })
  },
  {
    optOut: {
      from: ['sqlserver', 'mysql', 'sqlite', 'mongodb'],
      reason: 'BigInt[] / Decimal[] scalar lists are only supported on PostgreSQL and CockroachDB',
    },
  },
)
