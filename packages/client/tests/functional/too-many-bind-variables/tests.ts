import testMatrix from './_matrix'
// @ts-ignore
import type * as imports from './node_modules/@prisma/client'

declare let prisma: imports.PrismaClient

testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    const n = 32768

    async function generatedIds(n: number) {
      // ["1","2",...,"n"]
      const ids = Array.from({ length: n }, (_, i) => i + 1).map((id) => `${id}`)

      await prisma.model.createMany({
        data: ids.map((id) => ({ id, field: '' })),
      })

      return ids
    }

    function selectWithIds(ids: string[]) {
      return prisma.model.findMany({
        where: {
          OR: [
            {
              id: { in: ids },
            },
            {
              id: { in: ids },
            },
          ],
        },
      })
    }

    testIf(providerFlavor === undefined)(
      'Using Rust drivers with massive filter list results in "too many bind variables" error',
      async () => {
        const ids = await generatedIds(n)

        try {
          await selectWithIds(ids)

          // unreachable
          expect(true).toBe(false)
        } catch (error) {
          const e = error as Error

          expect(e.message).toContain('Assertion violation on the database')
          expect(e.message).toContain('too many bind variables in prepared statement')
        }
      },
    )

    testIf(providerFlavor !== undefined)(
      'Using Driver Adapters with massive filter list does not cause errors',
      async () => {
        const ids = await generatedIds(n)
        const result = await selectWithIds(ids)

        expect(result.length).toBe(n * 2)
      },
    )
  },
  {
    optOut: {
      from: ['cockroachdb', 'sqlserver', 'mongodb'],
      reason: 'not interesting for this test',
    },
    skipProviderFlavor: {
      from: ['js_planetscale'],

      // `rpc error: code = Aborted desc = Row count exceeded 10000 (CallerID: userData1)", state: "70100"`
      // This could potentially be configured in Vitess by increasing the `queryserver-config-max-result-size`
      // query server parameter.
      reason: 'Vitess supports at most 10k rows returned in a single query, so this test is not applicable',
    },
  },
)
