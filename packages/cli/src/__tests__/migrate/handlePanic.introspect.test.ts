import path from 'path'

import { DbPull } from '../../migrate/commands/DbPull'

describe('introspection panic', () => {
  let originalCwd: string

  beforeAll(() => {
    originalCwd = process.cwd()
  })

  afterAll(() => {
    process.chdir(originalCwd)
  })

  test('force panic', async () => {
    expect.assertions(1)
    process.env.FORCE_PANIC_SCHEMA_ENGINE = '1'
    process.chdir(path.resolve(__dirname, '..', 'fixtures', 'introspection', 'sqlite'))

    const introspect = new DbPull()
    try {
      await introspect.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        Error in Schema engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic

      `)
    }
  })
})
