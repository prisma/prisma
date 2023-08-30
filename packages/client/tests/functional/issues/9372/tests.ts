// @ts-ignore
import type { PrismaClient } from '@prisma/client'

import testMatrix from './_matrix'

declare let prisma: PrismaClient
const testIf = (condition: boolean) => (condition ? test : test.skip)

testMatrix.setupTestSuite(
  () => {
    jest.setTimeout(120_000)

    const isBuildkite = Boolean(process.env.BUILDKITE)

    // TODO: Tech Debt, this fails only on Buildkite and not GitHub Actions:
    // It succeeds on GitHub Actions with Node v14/16/18/20
    // It succeeds on Buildkite with Node v14 but fails with Node v16
    // So we skip it for Buildkite runs for now to unblock upgrading to Node v16.
    // Failure without - NODE_OPTIONS="--max-old-space-size=8096" is OOM
    // Failure with - NODE_OPTIONS="--max-old-space-size=8096" is "A jest worker process (pid=1115) was terminated by another process: signal=SIGKILL, exitCode=null. Operating system logs may contain more information on why this occurred."
    testIf(!isBuildkite)('does not crash on large amount of items inserted', async () => {
      const result = prisma.dictionary.create({
        data: {
          entries: {
            create: Array.from({ length: 150_000 }).map(() => ({
              term: 'foo',
            })),
          },
        },
      })

      await expect(result).resolves.not.toThrow()
    })
  },
  {
    optOut: {
      from: ['postgresql', 'mysql', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: `
        This test is fairly slow and the issue it is testing is not provider-dependent.
        Just for the sake of keeping test times acceptable, we are testing it only on sqlite
      `,
    },
  },
)
