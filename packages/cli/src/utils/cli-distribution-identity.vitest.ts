import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const distributionMarker = '__PRISMA_CLI_DISTRIBUTION'
const identityKey = Symbol.for('prisma.cli.distributionIdentity')

beforeEach(() => {
  delete process.env[distributionMarker]
  Reflect.deleteProperty(globalThis, identityKey)
  vi.resetModules()
})

afterEach(() => {
  delete process.env[distributionMarker]
  Reflect.deleteProperty(globalThis, identityKey)
})

describe('CLI distribution identity', () => {
  it('defaults ordinary Prisma invocations to the existing distribution', async () => {
    const { cliDistributionIdentity } = await import('./cli-distribution-identity')

    expect(cliDistributionIdentity).toEqual({
      name: 'prisma',
      commandName: 'prisma',
      packageName: 'prisma',
      configPackageName: 'prisma/config',
    })
    expect(Object.isFrozen(cliDistributionIdentity)).toBe(true)
  })

  it('selects prisma7 and consumes its one-shot marker', async () => {
    process.env[distributionMarker] = 'prisma7'

    const { cliDistributionIdentity } = await import('./cli-distribution-identity')

    expect(cliDistributionIdentity).toEqual({
      name: 'prisma7',
      commandName: 'prisma7',
      packageName: 'prisma7',
      configPackageName: 'prisma7/config',
    })
    expect(process.env[distributionMarker]).toBeUndefined()
  })

  it('cannot change identity after startup and still consumes a later marker', async () => {
    const firstImport = await import('./cli-distribution-identity')

    process.env[distributionMarker] = 'prisma7'
    vi.resetModules()
    const secondImport = await import('./cli-distribution-identity')

    expect(secondImport.cliDistributionIdentity).toBe(firstImport.cliDistributionIdentity)
    expect(secondImport.cliDistributionIdentity.name).toBe('prisma')
    expect(process.env[distributionMarker]).toBeUndefined()
  })
})
