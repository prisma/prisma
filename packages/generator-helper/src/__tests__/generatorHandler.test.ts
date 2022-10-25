import path from 'path'

import { GeneratorProcess } from '../GeneratorProcess'
import type { GeneratorOptions } from '../types'

const testIf = (condition: boolean) => (condition ? test : test.skip)

const stubOptions: GeneratorOptions = {
  datamodel: '',
  datasources: [],
  dmmf: {
    datamodel: {
      enums: [],
      models: [],
      types: [],
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
    provider: {
      value: '',
      fromEnvVar: null,
    },
    previewFeatures: [],
  },
  otherGenerators: [],
  schemaPath: '',
  version: 'latest',
}

function getExecutable(name: string): string {
  let fullName = path.join(__dirname, name)
  if (process.platform === 'win32') {
    fullName += '.cmd'
  }
  return fullName
}

describe('generatorHandler', () => {
  // TODO: Windows: this test fails with timeout.
  testIf(process.platform !== 'win32')('exiting', async () => {
    const generator = new GeneratorProcess(getExecutable('exiting-executable'))
    await generator.init()
    try {
      await generator.generate(stubOptions)
      generator.stop()
    } catch (e) {
      expect(e.message).toContain('Console error before exit')
    }
  })

  // TODO: Windows: this test fails with ENOENT even though the .cmd file is there and can be run manually.
  testIf(process.platform !== 'win32')(
    'parsing error',
    async () => {
      const generator = new GeneratorProcess(getExecutable('invalid-executable'), { initWaitTime: 5000 })
      await expect(() => generator.init()).rejects.toThrow('Cannot find module')
    },
    10_000,
  )

  test('minimal-executable', async () => {
    const generator = new GeneratorProcess(getExecutable('minimal-executable'))
    await generator.init()
    const manifest = await generator.getManifest(stubOptions.generator)
    expect(manifest).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "default-output",
        "denylists": Object {
          "models": Array [
            "SomeForbiddenModel",
          ],
        },
        "prettyName": "This is a pretty name",
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
    const generator = new GeneratorProcess(getExecutable('failing-executable'))
    await generator.init()
    await expect(generator.getManifest(stubOptions.generator)).rejects.toThrow()
    await expect(generator.generate(stubOptions)).rejects.toThrow()
    generator.stop()
  })

  test('nonexistent executable', async () => {
    const generator = new GeneratorProcess(getExecutable('random path that doesnt exist'))
    await expect(() => generator.init()).rejects.toThrow()
  })
})
