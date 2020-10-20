import path from 'path'
import { Introspect } from '../Introspect'

describe('introspection panic', () => {
  test('force panic', async () => {
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'
    process.chdir(path.join(__dirname, 'fixtures', 'introspection', 'sqlite'))

    const introspect = new Introspect()
    try {
      await introspect.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `[introspection-engine/core/src/rpc.rs:0:0] This is the debugPanic artificial panic`,
      )
    }
  })
})
