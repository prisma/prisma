import path from 'path'
import { Introspect } from '../commands/Introspect'

describe('panic', () => {
  test('should panic', async () => {
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'
    process.chdir(path.join(__dirname, 'fixture'))
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
