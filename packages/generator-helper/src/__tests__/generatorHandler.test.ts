import path from 'path'

import { GeneratorProcess } from '../GeneratorProcess'
import type { GeneratorOptions } from '../types'

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
      fieldRefTypes: {},
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
  dataProxy: false,
}

function getExecutable(name: string): string {
  let fullName = path.join(__dirname, name)
  if (process.platform === 'win32') {
    fullName += '.cmd'
  }
  return fullName
}

describe('generatorHandler', () => {
  test('exiting', async () => {
    const generator = new GeneratorProcess(getExecutable('exiting-executable'))
    await generator.init()
    try {
      await generator.generate(stubOptions)
      generator.stop()
    } catch (e) {
      expect(e.message).toContain('Console error before exit')
    }
  })

  test('parsing error', async () => {
    const generator = new GeneratorProcess(getExecutable('invalid-executable'))
    await generator.init()
    await expect(() => generator.getManifest(stubOptions.generator)).rejects.toThrow('Cannot find module')
  }, 10_000)

  test('minimal-executable', async () => {
    const generator = new GeneratorProcess(getExecutable('minimal-executable'))
    await generator.init()
    const manifest = await generator.getManifest(stubOptions.generator)
    expect(manifest).toMatchInlineSnapshot(`
      {
        "defaultOutput": "default-output",
        "denylists": {
          "models": [
            "SomeForbiddenModel",
          ],
        },
        "prettyName": "This is a pretty name",
        "requiresEngines": [
          "migration-engine",
          "query-engine",
        ],
        "requiresGenerators": [
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

  test('failing-after-1s-executable', async () => {
    const generator = new GeneratorProcess(getExecutable('failing-after-1s-executable'))
    await generator.init()
    await expect(generator.getManifest(stubOptions.generator)).rejects.toThrow('test')
    generator.stop()
  })

  test('nonexistent executable', async () => {
    const generator = new GeneratorProcess(getExecutable('this-executable-does-not-exist'))
    await generator.init()
    await expect(generator.getManifest(stubOptions.generator)).rejects.toThrow()
  })
})
