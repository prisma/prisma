import { afterEach, describe, expect, it } from 'vitest'

import { delegateToPrismaCli, prismaCliEntrypoint } from './delegate-to-prisma-cli'

const distributionMarker = '__PRISMA_CLI_DISTRIBUTION'
const originalArgv = process.argv
const originalExitCode = process.exitCode

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  delete process.env[distributionMarker]
})

describe('delegateToPrismaCli', () => {
  it('loads the published Prisma CLI entrypoint from its declared dependency', () => {
    expect(prismaCliEntrypoint).toBe('prisma/build/index.js')
  })

  it.each([
    ['normal CLI arguments', ['node', 'prisma7', 'generate', '--no-hints']],
    ['completion arguments', ['node', 'prisma7', 'complete', '--', 'migrate', 'd']],
  ])('preserves %s', (_description, argv) => {
    process.argv = argv
    const delegatedResult = { loaded: true }
    let receivedArgv: string[] | undefined

    const result = delegateToPrismaCli(() => {
      receivedArgv = process.argv
      return delegatedResult
    })

    expect(receivedArgv).toBe(argv)
    expect(result).toBe(delegatedResult)
    expect(process.env[distributionMarker]).toBe('prisma7')
  })

  it('does not alter exit behavior from the delegated CLI', () => {
    delegateToPrismaCli(() => {
      process.exitCode = 23
    })

    expect(process.exitCode).toBe(23)
  })
})
