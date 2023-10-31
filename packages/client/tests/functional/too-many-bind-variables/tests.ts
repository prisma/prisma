import testMatrix from './_matrix'
// @ts-ignore
import type * as imports from './node_modules/@prisma/client'

declare let prisma: imports.PrismaClient

testMatrix.setupTestSuite(
  ({ providerFlavor }) => {
    const N_LARGE = 32768
    const N_LARGER = 65536

    function generatedIds(n: number) {
      // ["1","2",...,"n"]
      const ids = Array.from({ length: n }, (_, i) => i + 1).map((id) => `${id}`)
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
        for (const n of [N_LARGE, N_LARGER]) {
          const ids = generatedIds(n)

          try {
            await selectWithIds(ids)
            // unreachable
            expect(true).toBe(false)
          } catch (error) {
            const e = error as Error

            expect(e.message).toContain('Assertion violation on the database')
            expect(e.message).toContain('too many bind variables in prepared statement')
          }
        }
      },
    )

    testIf(providerFlavor !== undefined)(
      'Using Driver Adapters with massive filter list does not cause errors',
      async () => {
        const n = N_LARGE
        const ids = generatedIds(n)
        await selectWithIds(ids)
      },
    )

    testIf(providerFlavor !== undefined)('Using Driver Adapters with larger filter list triggers errors', async () => {
      const n = N_LARGER
      const ids = generatedIds(n)

      expect.assertions(1)

      try {
        await selectWithIds(ids)
      } catch (error) {
        const e = error as Error

        expect(e.message).toContain(
          'code: "08P01", message: "bind message has 32767 parameter formats but 0 parameters"',
        )
      }
    })
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
