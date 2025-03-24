import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { getBinaryTargetForCurrentPlatform, jestConsoleContext, jestContext } from '@prisma/get-platform'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { loadSchemaContext } from '../../cli/schemaContext'
import { GeneratorRegistry, getGenerators } from '../../get-generators/getGenerators'
import { resolveBinary } from '../../resolveBinary'
import { omit } from '../../utils/omit'
import { pick } from '../../utils/pick'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const testIf = (condition: boolean) => (condition ? test : test.skip)

if (process.env.CI) {
  // 20s is often not enough on CI, especially on macOS.
  jest.setTimeout(60_000)
} else {
  jest.setTimeout(20_000)
}

let generatorPath = path.join(__dirname, 'generator')

if (process.platform === 'win32') {
  generatorPath += '.cmd'
}

expect.addSnapshotSerializer({
  test: (val) =>
    val && typeof val === 'object' && typeof val['sourceFilePath'] === 'string' && path.isAbsolute(val.sourceFilePath),
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = { ...val, sourceFilePath: path.relative(__dirname, val.sourceFilePath) }
    return printer(newVal, config, indentation, depth, refs)
  },
})

expect.addSnapshotSerializer({
  test: (val) => typeof val === 'string' && val.includes(__dirname),
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = val.replaceAll(__dirname, '/project')
    return printer(newVal, config, indentation, depth, refs)
  },
})

const registry = {
  'predefined-generator': {
    type: 'rpc',
    generatorPath: generatorPath,
  },
} satisfies GeneratorRegistry

describe('getGenerators', () => {
  test('basic', async () => {
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen {
        provider      = "predefined-generator"
        binaryTargets = ["darwin"]
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "value": "darwin",
          },
        ],
        "config": {},
        "name": "gen",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema.prisma",
      }
    `)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets - native string', async () => {
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema-binaryTargets.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen_env {
        provider      = "predefined-generator"
        binaryTargets = "native"
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema-binaryTargets.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(binaryTarget)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual(null)

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      {
        "config": {},
        "name": "gen_env",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema-binaryTargets.prisma",
      }
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets as env var - native string', async () => {
    process.env.BINARY_TARGETS_ENV_VAR_TEST = '"native"'

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen_env {
        provider      = "predefined-generator"
        binaryTargets = env("BINARY_TARGETS_ENV_VAR_TEST")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(binaryTarget)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual('BINARY_TARGETS_ENV_VAR_TEST')

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      {
        "config": {},
        "name": "gen_env",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
      }
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets as env var - native (in array)', async () => {
    process.env.BINARY_TARGETS_ENV_VAR_TEST = '["native"]'

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen_env {
        provider      = "predefined-generator"
        binaryTargets = env("BINARY_TARGETS_ENV_VAR_TEST")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(binaryTarget)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual(null)

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      {
        "config": {},
        "name": "gen_env",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
      }
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets as env var - darwin, windows, debian', async () => {
    process.env.BINARY_TARGETS_ENV_VAR_TEST =
      '["darwin", "darwin-arm64", "windows", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]'

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen_env {
        provider      = "predefined-generator"
        binaryTargets = env("BINARY_TARGETS_ENV_VAR_TEST")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "value": "darwin",
          },
          {
            "fromEnvVar": null,
            "value": "darwin-arm64",
          },
          {
            "fromEnvVar": null,
            "value": "windows",
          },
          {
            "fromEnvVar": null,
            "value": "debian-openssl-1.1.x",
          },
          {
            "fromEnvVar": null,
            "value": "debian-openssl-3.0.x",
          },
        ],
        "config": {},
        "name": "gen_env",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
      }
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets as env var - linux-musl (missing current platform)', async () => {
    process.env.BINARY_TARGETS_ENV_VAR_TEST = '["linux-musl"]'

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      [
        {
          "defaultOutput": "/project",
          "denylist": [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty name",
          "requiresEngines": [
            "queryEngine",
            "schemaEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      {
        "datamodel": "datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      generator gen_env {
        provider      = "predefined-generator"
        binaryTargets = env("BINARY_TARGETS_ENV_VAR_TEST")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": [
          {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "schemas": [],
            "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
            "url": {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "value": "linux-musl",
          },
        ],
        "config": {},
        "name": "gen_env",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
        "sourceFilePath": "valid-minimal-schema-binaryTargets-env-var.prisma",
      }
    `)

    const consoleLog = stripAnsi(ctx.mocked['console.log'].mock.calls.join('\n'))
    expect(consoleLog).toContain('Warning: Your current platform')
    expect(consoleLog).toContain(`s not included in your generator's \`binaryTargets\` configuration`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  testIf(!process.env.PRISMA_SCHEMA_ENGINE_BINARY)('inject engines', async () => {
    const schemaEngine = await resolveBinary(BinaryType.SchemaEngineBinary)

    const queryEngineBinaryType = getCliQueryEngineBinaryType()
    const queryEnginePath = await resolveBinary(queryEngineBinaryType)

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'valid-minimal-schema.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
      binaryPathsOverride: {
        queryEngine: queryEnginePath,
      },
    })

    const options = generators.map((g) => g.options?.binaryPaths)

    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    // we override queryEngine, so its paths should be equal to the one of the generator
    expect(options[0]?.queryEngine?.[binaryTarget]).toBe(queryEnginePath)
    // we did not override the schemaEngine, so their paths should not be equal
    expect(options[0]?.schemaEngine?.[binaryTarget]).not.toBe(schemaEngine)

    generators.forEach((g) => g.stop())
  })

  test('filter generator names', async () => {
    const registry = {
      'predefined-generator-1': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-2': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-3': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'multiple-generators-schema.prisma'),
    })
    const generators = await getGenerators({
      schemaContext,
      registry,
      generatorNames: ['client_1', 'client_3'],
    })

    expect(generators).toHaveLength(2)
    expect(generators[0].config.name).toEqual('client_1')
    expect(generators[0].getProvider()).toEqual('predefined-generator-1')
    expect(generators[1].config.name).toEqual('client_3')
    expect(generators[1].getProvider()).toEqual('predefined-generator-3')

    generators.forEach((g) => g.stop())
  })

  test('fail on platforms', async () => {
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'invalid-platforms-schema.prisma'),
    })

    await expect(
      getGenerators({
        schemaContext,
        registry,
      }),
    ).rejects.toThrow('deprecated')
  })

  test('fail on invalid binaryTarget', async () => {
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'invalid-binary-target-schema.prisma'),
    })

    await expect(
      getGenerators({
        schemaContext,
        registry,
      }),
    ).rejects.toThrow('Unknown')

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if datasource is missing', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-datasource-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any datasource defined in your schema.prisma.
        You can define a datasource like this:

        datasource db {
          provider = "postgresql"
          url      = env("DB_URL")
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if no model(s) found - sqlite', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-sqlite-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any models defined in your schema.prisma, so nothing will be generated.
        You can define a model like this:

        model User {
          id    Int     @id @default(autoincrement())
          email String  @unique
          name  String?
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if no model(s) found - mongodb', async () => {
    expect.assertions(5)
    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-mongodb-schema.prisma'),
      ignoreEnvVarErrors: true,
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any models defined in your schema.prisma, so nothing will be generated.
        You can define a model like this:

        model User {
          id    String  @id @default(auto()) @map("_id") @db.ObjectId
          email String  @unique
          name  String?
        }

        More information in our documentation:
        https://pris.ly/d/prisma-schema
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if generator not found', async () => {
    expect.assertions(1)

    const registry = {
      'predefined-generator-1': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-2': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
      'predefined-generator-3': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'multiple-generators-schema.prisma'),
    })

    try {
      await getGenerators({
        schemaContext,
        registry,
        generatorNames: ['client_1', 'invalid_generator'],
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(
        `"The generator invalid_generator specified via --generator does not exist in your Prisma schema"`,
      )
    }
  })

  test('pass if no model(s) found but allow-no-models flag is passed - sqlite', async () => {
    expect.assertions(1)

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-sqlite-schema.prisma'),
    })

    const generators = await getGenerators({
      schemaContext,
      registry,
      allowNoModels: true,
    })

    return expect(generators.length).toBeGreaterThanOrEqual(1)
  })

  test('pass if no model(s) found but allow-no-models flag is passed - mongodb', async () => {
    expect.assertions(1)

    const registry = {
      'prisma-client-js': {
        type: 'rpc',
        generatorPath: generatorPath,
      },
    } satisfies GeneratorRegistry

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: path.join(__dirname, 'missing-models-mongodb-schema.prisma'),
      ignoreEnvVarErrors: true,
    })

    const generators = await getGenerators({
      schemaContext,
      registry,
      allowNoModels: true,
    })

    expect(generators.length).toBeGreaterThanOrEqual(1)
  })
})
