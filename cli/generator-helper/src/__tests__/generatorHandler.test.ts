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
  test('minimal-executable', async () => {
    const generator = new GeneratorProcess(
      path.join(__dirname, 'minimal-executable'),
    )
    const manifest = await generator.getManifest()
    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "default-output",
        "denylist": Array [
          "SomeForbiddenType",
        ],
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
    expect(generator.getManifest()).rejects.toMatchInlineSnapshot()
    expect(generator.generate(stubOptions)).rejects.toMatchInlineSnapshot()
  })
})
