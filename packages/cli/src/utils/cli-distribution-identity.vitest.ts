import { afterEach, describe, expect, it } from 'vitest'

import { getCliDistributionIdentity } from './cli-distribution-identity'

const originalArgv = process.argv

afterEach(() => {
  process.argv = originalArgv
})

describe('CLI distribution identity', () => {
  it.each([
    ['a POSIX shim path', '/project/node_modules/.bin/prisma7'],
    ['a POSIX built target', '/project/node_modules/prisma7/build/prisma7.js'],
    ['a Windows shim path', 'C:\\project\\node_modules\\.bin\\prisma7'],
    ['a Windows built target', 'C:\\project\\node_modules\\prisma7\\build\\prisma7.js'],
  ])('selects prisma7 from %s', (_description, executedScript) => {
    const identity = getCliDistributionIdentity(executedScript)

    expect(identity).toEqual({
      name: 'prisma7',
      commandName: 'prisma7',
      packageName: 'prisma7',
      configPackageName: 'prisma7/config',
    })
    expect(Object.isFrozen(identity)).toBe(true)
  })

  it.each([
    ['the Prisma executable', '/project/node_modules/.bin/prisma'],
    ['the built Prisma entrypoint', '/project/node_modules/prisma/build/index.js'],
    ['an unsupported executable name', '/project/bin/custom-prisma.js'],
    ['a missing executed script', undefined],
  ])('defaults to prisma for %s', (_description, executedScript) => {
    const identity = getCliDistributionIdentity(executedScript)

    expect(identity).toEqual({
      name: 'prisma',
      commandName: 'prisma',
      packageName: 'prisma',
      configPackageName: 'prisma/config',
    })
    expect(Object.isFrozen(identity)).toBe(true)
  })

  it('reads the executed script from process.argv by default', () => {
    process.argv = [process.execPath, '/project/node_modules/.bin/prisma7']

    expect(getCliDistributionIdentity().name).toBe('prisma7')
  })
})
