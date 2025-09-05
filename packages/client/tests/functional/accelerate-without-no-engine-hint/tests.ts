import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './generated/prisma/client'

declare const newPrismaClient: NewPrismaClient<PrismaClient, typeof PrismaClient>

testMatrix.setupTestSuite(
  ({ provider, clientRuntime }, suiteMeta, { dataProxy }) => {
    testIf(dataProxy === false && clientRuntime !== 'client')(
      'using Accelerate without --no-engine or QC produces a warning at runtime',
      () => {
        process.env[`DATABASE_URI_${provider}`] = 'prisma://accelerate.net/?api_key=doesNotMatter'
        const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation()

        newPrismaClient()

        // should only warn once
        newPrismaClient()

        expect(consoleWarnMock).toHaveBeenCalledTimes(1)
        expect(consoleWarnMock.mock.calls[0]).toMatchInlineSnapshot(`
        [
          "prisma:warn In production, we recommend using \`prisma generate --no-engine\` (See: \`prisma generate --help\`)",
        ]
      `)

        consoleWarnMock.mockRestore()
      },
    )

    testIf(dataProxy === true && clientRuntime !== 'client')(
      'using Accelerate with --no-engine without QC produces no warning at runtime',
      () => {
        process.env[`DATABASE_URI_${provider}`] = 'prisma://accelerate.net/?api_key=doesNotMatter'
        const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation()

        newPrismaClient()

        expect(consoleWarnMock).toHaveBeenCalledTimes(0)
        consoleWarnMock.mockRestore()
      },
    )

    testIf(clientRuntime === 'client')(
      'using Accelerate without --no-engine with QC produces no warning at runtime',
      () => {
        process.env[`DATABASE_URI_${provider}`] = 'prisma://accelerate.net/?api_key=doesNotMatter'
        const consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation()

        newPrismaClient()

        expect(consoleWarnMock).toHaveBeenCalledTimes(0)
        consoleWarnMock.mockRestore()
      },
    )
  },
  {
    optOut: {
      from: ['cockroachdb', 'mongodb', 'mysql', 'sqlserver', 'sqlite'],
      reason: 'warnOnce can only be tested one time per process',
    },
    skipDefaultClientInstance: true,
    skip(when, { driverAdapter }) {
      when(driverAdapter !== undefined, 'Driver adapters cannot be used with accelerate')
    },
  },
)
