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
    mappings: [],
    schema: {
      enums: [],
      inputTypes: [],
      outputTypes: [],
    },
  },
  generator: {
    config: {},
    name: 'some-generator',
    output: null,
    binaryTargets: [],
    provider: '',
  },
  otherGenerators: [],
  schemaPath: '',
}

describe('generatorHandler', () => {
  test('not executable', async () => {
    expect(() => {
      const generator = new GeneratorProcess(
        path.join(__dirname, 'not-executable'),
      )
    }).toThrow('is not executable')
    // expect(generator.init()).rejects.toThrow('is not executable')
  })
  test('parsing error', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'invalid-executable'),
    )
    await expect(generator.init()).rejects.toThrow(
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
          "photonjs",
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
    expect(generator.getManifest()).rejects.toThrow()
    expect(generator.generate(stubOptions)).rejects.toThrow()
    generator.stop()
  })
})
