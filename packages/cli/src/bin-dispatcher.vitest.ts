import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const dispatcherPath = path.join(__dirname, '../build/index.js')
const identityHelperPath = path.join(__dirname, 'utils/cli-distribution-identity.ts')

const dispatcherProbe = `
const Module = require('node:module')
const [branch, dispatcherPath, executedScript] = process.argv.slice(1)
const originalLoad = Module._load

Module._load = function (request, parent, isMain) {
  if (request === './cli.js' || request === './completion.js') {
    process.stdout.write(JSON.stringify({ branch: request, executedScript: process.argv[1] }))
    return {}
  }

  return originalLoad.call(this, request, parent, isMain)
}

process.argv = [process.execPath, executedScript, ...(branch === 'complete' ? ['complete'] : [])]
require(dispatcherPath)
`

function runBuiltDispatcher(branch: 'normal' | 'complete', executedScript: string) {
  const result = spawnSync(process.execPath, ['-e', dispatcherProbe, branch, dispatcherPath, executedScript], {
    encoding: 'utf8',
  })

  expect(result.status).toBe(0)
  expect(result.stderr).toBe('')

  return JSON.parse(result.stdout) as { branch: string; executedScript: string }
}

describe('built CLI dispatcher', () => {
  it.each([
    ['normal', './cli.js', '/project/node_modules/prisma7/build/prisma7.js'],
    ['complete', './completion.js', '/project/node_modules/.bin/prisma7'],
  ] as const)(
    'dispatches the %s branch without rewriting the invoked script',
    (branch, expectedModule, executedScript) => {
      expect(runBuiltDispatcher(branch, executedScript)).toEqual({ branch: expectedModule, executedScript })
    },
  )

  it('does not retain mutable distribution transport', () => {
    const identityHelper = readFileSync(identityHelperPath, 'utf8')
    const dispatcher = readFileSync(dispatcherPath, 'utf8')

    expect(identityHelper).not.toContain('process.env')
    expect(identityHelper).not.toContain('globalThis')
    expect(identityHelper).not.toContain('Symbol.for')
    expect(dispatcher).not.toContain('cli-distribution-identity')
  })
})
