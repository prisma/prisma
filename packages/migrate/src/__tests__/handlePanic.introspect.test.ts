import path from 'path'

import { DbPull } from '../commands/DbPull'

describe('introspection panic', () => {
  test('force panic', async () => {
    expect.assertions(1)
    process.env.FORCE_PANIC_SCHEMA_ENGINE = '1'
    process.chdir(path.join(__dirname, 'fixtures', 'introspection', 'sqlite'))

    const introspect = new DbPull()
    try {
      await introspect.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic
        "
      `)
    }
  })
})
