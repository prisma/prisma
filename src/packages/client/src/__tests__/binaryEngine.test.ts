import { BinaryEngine } from '@prisma/engine-core/dist/BinaryEngine'
import path from 'path'

describe('BinaryEngine', () => {
  test('should error correctly with invalid flags', async () => {
    
    // Skip for Node-API library
    // TODO Better scoping when to run this test so this conditional is not necessary
    if (process.env.PRISMA_FORCE_NAPI === 'true') {
      return
    }

    try {
      const engine = new BinaryEngine({
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
