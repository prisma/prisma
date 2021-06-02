import { NodeEngine } from '@prisma/engine-core/dist/NodeEngine'
import path from 'path'

describe('engine', () => {
  test('should error correctly with invalid flags', async () => {
    if (process.env.PRISMA_FORCE_NAPI === 'true') {
      return
    }
    try {
      const engine = new NodeEngine({
        flags: ['--flag-that-does-not-exist'],
        datamodelPath: path.join(
          __dirname,
          './runtime-tests/blog/schema.prisma',
        ),
      })
      await engine.start()
    } catch (e) {
      expect(e.message).toMatch(
        ` Found argument '--flag-that-does-not-exist' which wasn't expected`,
      )
    }
  })
})
