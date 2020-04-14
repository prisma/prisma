import { NodeEngine } from '@prisma/engine-core/dist/NodeEngine'
import path from 'path'

describe('engine', () => {
  test('should error correctly with invalid flags', async () => {
    const engine = new NodeEngine({
      flags: ['--flag-that-does-not-exist'],
      datamodelPath: path.join(__dirname, './runtime-tests/blog/schema.prisma'),
    })

    await expect(
      engine.start().catch(e => {
        throw new Error(
          e.message.replace(/query-engine-.*\n/, 'query-engine\n'),
        )
      }),
    ).rejects.toMatchInlineSnapshot(`
            [Error: 
            error: Found argument '--flag-that-does-not-exist' which wasn't expected, or isn't valid in this context
            USAGE:
                query-engine
            For more information try --help]
          `)
  })
})
