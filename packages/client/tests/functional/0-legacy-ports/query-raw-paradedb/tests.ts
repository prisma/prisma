import { createCustomTypeCast } from '../../../../src/runtime/utils/preserveCustomTypeCasting'
import testMatrix from './_matrix'

// @ts-ignore
import type * as $ from './generated/prisma/client'

declare let prisma: $.PrismaClient

testMatrix.setupTestSuite(
  ({ provider }) => {
    // Only test with PostgreSQL since ParadeDB is a PostgreSQL extension
    if (provider !== 'postgresql') {
      return
    }

    test('should handle ParadeDB custom type casting with $queryRawUnsafe', async () => {
      const query = `
        SELECT
          sv."songId",
          AVG(pdb.score(sv.id))::numeric as "avgScore"
        FROM song_variants sv
        WHERE
          (sv."searchTitle" &&& $1
           OR sv."lyrics" &&& $2
           OR sv."searchTitle" &&& $3
           OR sv."lyrics" &&& $4)
          AND sv."deletedAt" IS NULL
        GROUP BY sv."songId"
        ORDER BY AVG(pdb.score(sv.id)) DESC
        LIMIT 10
      `

      const searchTerm = 'test search'
      
      // This should work without throwing the XX000 error
      const result = await prisma.$queryRawUnsafe(
        query,
        createCustomTypeCast(searchTerm, '::pdb.boost(5)'),
        createCustomTypeCast(searchTerm, '::pdb.boost(5)'),
        createCustomTypeCast(searchTerm, '::pdb.fuzzy(1)::pdb.boost(3)'),
        createCustomTypeCast(searchTerm, '::pdb.fuzzy(1)::pdb.boost(3)')
      )

      // The query should execute without error
      expect(Array.isArray(result)).toBe(true)
    })

    test('should handle mixed regular and custom type cast parameters', async () => {
      const query = `
        SELECT *
        FROM song_variants sv
        WHERE sv."searchTitle" &&& $1
          AND sv."createdAt" > $2
          AND sv."lyrics" &&& $3
        LIMIT $4
      `

      const result = await prisma.$queryRawUnsafe(
        query,
        createCustomTypeCast('search term', '::pdb.boost(5)'),
        new Date('2020-01-01'),
        createCustomTypeCast('lyrics search', '::pdb.fuzzy(2)'),
        10
      )

      expect(Array.isArray(result)).toBe(true)
    })

    test('should work with complex ParadeDB queries', async () => {
      const query = `
        SELECT
          sv."songId",
          pdb.score(sv.id) as score
        FROM song_variants sv
        WHERE
          (sv."searchTitle" &&& $1
           OR sv."searchTitle" &&& $2
           OR sv."searchTitle" &&& $3)
        ORDER BY pdb.score(sv.id) DESC
      `

      const searchTerm = 'complex search'
      
      const result = await prisma.$queryRawUnsafe(
        query,
        createCustomTypeCast(searchTerm, '::pdb.boost(5)'),
        createCustomTypeCast(searchTerm, '::pdb.fuzzy(1)::pdb.boost(3)'),
        createCustomTypeCast(searchTerm, '::pdb.fuzzy(2)')
      )

      expect(Array.isArray(result)).toBe(true)
    })
  },
  {
    optOut: {
      from: ['mysql', 'sqlite', 'sqlserver', 'cockroachdb', 'mongodb'],
      reason: 'ParadeDB is a PostgreSQL-specific extension',
    },
  },
)