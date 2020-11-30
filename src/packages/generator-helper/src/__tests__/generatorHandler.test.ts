import { GeneratorProcess } from '../GeneratorProcess'
import path from 'path'
import { GeneratorOptions } from '../types'

const stubOptions: GeneratorOptions = {
  datamodel: '',
  datasources: [],
  dmmf: {
    datamodel: {
      enums: [],
      models: [],
    },
    mappings: {
      modelOperations: [],
      otherOperations: {
        read: [],
        write: [],
      },
    },
    schema: {
      enumTypes: {
        prisma: [],
      },
      inputObjectTypes: {
        prisma: [],
      },
      outputObjectTypes: {
        model: [],
        prisma: [],
      },
    },
  },
  generator: {
    config: {},
    name: 'some-generator',
    output: null,
    binaryTargets: [],
    provider: '',
    previewFeatures: [],
  },
  otherGenerators: [],
  schemaPath: '',
  version: 'latest',
}

describe('generatorHandler', () => {
  test('exiting', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'exiting-executable'),
    )
    await generator.init()
    try {
      await generator.generate(stubOptions)
      generator.stop()
    } catch (e) {
      expect(e.message).toContain('Console error before exit')
    }
  })
  test('parsing error', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'invalid-executable'),
    )
    await expect(() => generator.init()).rejects.toThrow(
      `Cannot find module 'ms-node/register'`,
    )
  })
  test('minimal-executable', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'minimal-executable'),
    )
    await generator.init()
    const manifest = await generator.getManifest()
    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "default-output",
        "denylists": Object {
          "models": Array [
            "SomeForbiddenModel",
          ],
        },
        "prettyName": "This is a pretty pretty name",
        "requiresEngines": Array [
          "introspection-engine",
          "query-engine",
        ],
        "requiresGenerators": Array [
          "prisma-client-js",
        ],
      }
    `)
    expect(() => generator.generate(stubOptions)).not.toThrow()

    generator.stop()
  })
  test('failing-executable', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'failing-executable'),
    )
    await generator.init()
    await expect(generator.getManifest()).rejects.toThrow()
    await expect(generator.generate(stubOptions)).rejects.toThrow()
    generator.stop()
  })
  test('non existent executable', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'random path that doesnt exist'),
    )
    await expect(() => generator.init()).rejects.toThrow()
  })
})
