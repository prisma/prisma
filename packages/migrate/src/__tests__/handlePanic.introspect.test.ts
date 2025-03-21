import { defaultTestConfig } from '@prisma/config'
import { jestContext } from '@prisma/get-platform'
import path from 'path'

import { DbPull } from '../commands/DbPull'

const ctx = jestContext.new().assemble()

describe('introspection panic', () => {
  test('force panic', async () => {
    expect.assertions(1)
    process.env.FORCE_PANIC_SCHEMA_ENGINE = '1'
    ctx.fixture(path.join('introspection', 'sqlite'))

    const introspect = new DbPull()
    try {
      await introspect.parse(['--print'], defaultTestConfig())
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic
        "
      `)
    }
  })
})
