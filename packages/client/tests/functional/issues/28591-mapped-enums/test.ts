import testMatrix from './_matrix'
// @ts-ignore
import type * as imports from './generated/prisma/client'

declare let prisma: imports.PrismaClient
declare let loaded: {
  SuggestionStatus: typeof imports.SuggestionStatus
}

testMatrix.setupTestSuite(
  () => {
    test('create with mapped enum', async () => {
      const { SuggestionStatus } = loaded

      expect(SuggestionStatus.PENDING).toBe('pending')

      /**
      Currently, this fails with:

      ```
      PrismaClientValidationError: 
      Invalid `prisma.suggestionModel.create()` invocation in
      /Users/jkomyno/work/prisma/prisma/packages/client/tests/functional/issues/28591-mapped-enums/test.ts:17:55

        14 
        15 expect(SuggestionStatus.PENDING).toBe('pending')
        16 
      → 17 const enrichment = await prisma.suggestionModel.create({
            data: {
              suggestedContent: "some content",
              status: "pending"
                      ~~~~~~~~~
            }
          })

      Invalid value for argument `status`. Expected SuggestionStatus.

        44 |   })
        45 |
      > 46 |   throw new PrismaClientValidationError(messageWithContext, { clientVersion })
          |         ^
        47 | }
        48 |
      ```
       */
      const enrichment = await prisma.suggestionModel.create({
        data: {
          suggestedContent: 'some content',
          status: SuggestionStatus.PENDING, // evaluates to "pending" - causes runtime error
        },
      })

      expect(enrichment.status).toBe('PENDING')
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'Issue reported for Postgres, keeping it focused.',
    },
  },
)
