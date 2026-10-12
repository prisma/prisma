import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare let prisma: PrismaClient

/**
 * Regression test for https://github.com/prisma/prisma/issues/30580
 * PostgreSQL can report a serializable write conflict while committing an interactive transaction.
 * The commit error must be converted to P2034 just like a conflict raised while executing a query.
 */
testMatrix.setupTestSuite(
  () => {
    beforeEach(async () => {
      await prisma.appSetting.deleteMany()
    })

    test('commit-time write conflicts are surfaced as P2034', async () => {
      const prefix = 'probe-'
      let reads = 0
      let release!: () => void
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })

      const run = (suffix: number) =>
        prisma.$transaction(
          async (tx) => {
            await tx.appSetting.count({ where: { key: { startsWith: prefix } } })

            // Release the barrier even if this transaction throws later, so the
            // other transaction can never hang waiting on the gate.
            reads += 1
            if (reads === 2) release()
            await gate

            await tx.appSetting.create({
              data: { key: `${prefix}${suffix}`, value: 'x' },
            })
          },
          { isolationLevel: 'Serializable' },
        )

      const results = await Promise.allSettled([run(1), run(2)])
      const rejected = results.filter((r) => r.status === 'rejected')
      const fulfilled = results.filter((r) => r.status === 'fulfilled')

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]).toMatchObject({
        reason: {
          name: 'PrismaClientKnownRequestError',
          code: 'P2034',
        },
      })

      // The pool must still be usable after the failed commit
      await expect(prisma.appSetting.count()).resolves.toBe(1)
    })
  },
  {
    optOut: {
      from: ['mongodb', 'mysql', 'sqlite', 'sqlserver', 'cockroachdb'],
      reason: 'Serializable write skew surfaced as SQLSTATE 40001 at COMMIT is the PostgreSQL behavior from the issue',
    },
  },
)
