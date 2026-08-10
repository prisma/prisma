import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const dispatcherPath = path.join(__dirname, '../build/index.js')
const distributionMarker = '__PRISMA_CLI_DISTRIBUTION'

const dispatcherProbe = `
const Module = require('node:module')
const [branch, dispatcherPath] = process.argv.slice(1)
const identityKey = Symbol.for('prisma.cli.distributionIdentity')
const originalLoad = Module._load

Module._load = function (request, parent, isMain) {
  if (request === './cli.js' || request === './completion.js') {
    process.stdout.write(JSON.stringify({
      branch: request,
      identity: Reflect.get(globalThis, identityKey),
      marker: process.env.__PRISMA_CLI_DISTRIBUTION,
    }))
    return {}
  }

  return originalLoad.call(this, request, parent, isMain)
}

process.argv = [process.execPath, 'prisma7', branch]
require(dispatcherPath)
`

function runBuiltDispatcher(branch: 'normal' | 'complete') {
  const result = spawnSync(process.execPath, ['-e', dispatcherProbe, branch, dispatcherPath], {
    encoding: 'utf8',
    env: { ...process.env, [distributionMarker]: 'prisma7' },
  })

  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')

  return JSON.parse(result.stdout) as {
    branch: string
    identity: { name: string }
    marker: string | undefined
  }
}

describe('built CLI dispatcher', () => {
  it.each([
    ['normal', './cli.js'],
    ['complete', './completion.js'],
  ] as const)('initializes prisma7 identity before the %s branch', (branch, expectedModule) => {
    const result = runBuiltDispatcher(branch)

    expect(result).toEqual({
      branch: expectedModule,
      identity: expect.objectContaining({ name: 'prisma7' }),
    })
    expect(result.marker).toBeUndefined()
  })
})
