import path from 'path'
import { Introspect } from '../commands/Introspect'

describe('introspection panic', () => {
  test('force panic', async () => {
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'
    process.chdir(path.join(__dirname, 'fixture'))

    const introspect = new Introspect()
    try {
      await introspect.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `[Error: [introspection-engine/core/src/rpc.rs:156:9] This is the debugPanic artificial panic]`,
      )
    }
  })
})
