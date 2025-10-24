import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import path from 'node:path'

import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { BinaryEngine } from '../runtime/core/engines'
import { disabledTracingHelper } from '../runtime/core/tracing/TracingHelper'

describe('BinaryEngine', () => {
  test('should error correctly with invalid flags', async () => {
    // Skip for Node-API library
    // TODO Better scoping when to run this test so this conditional is not necessary
    if (getClientEngineType() === ClientEngineType.Library) {
      return
    }

    try {
      const engine = new BinaryEngine({
        dirname: __dirname,
        flags: ['--flag-that-does-not-exist'],
        tracingHelper: disabledTracingHelper,
        env: {},
        cwd: process.cwd(),
        logEmitter: new EventEmitter(),
        clientVersion: '0.0.0',
        engineVersion: '0000000000000000000000000000000000000000',
        inlineDatasources: {},
        inlineSchema: await fs.readFile(path.join(__dirname, 'runtime-tests/blog/schema.prisma'), 'utf8'),
        overrideDatasources: {},
        transactionOptions: {},
      })
      await engine.start()
    } catch (e) {
      expect(e.message).toMatch(` Found argument '--flag-that-does-not-exist' which wasn't expected`)
    }
  })
})
