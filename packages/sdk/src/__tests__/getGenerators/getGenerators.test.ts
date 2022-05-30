import { getCliQueryEngineBinaryType } from '@prisma/engines'
import { BinaryType } from '@prisma/fetch-engine'
import { getPlatform } from '@prisma/get-platform'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { getGenerators } from '../../get-generators/getGenerators'
import { resolveBinary } from '../../resolveBinary'
import { jestConsoleContext, jestContext } from '../../utils/jestContext'
import { omit } from '../../utils/omit'
import { pick } from '../../utils/pick'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

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

describe('getGenerators', () => {
  test('basic', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen {
        provider      = \\"predefined-generator\\"
        binaryTargets = [\\"darwin\\"]
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      Object {
        "binaryTargets": Array [
          Object {
            "fromEnvVar": null,
            "value": "darwin",
          },
        ],
        "config": Object {},
        "name": "gen",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
      }
    `)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets - native string', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema-binaryTargets.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen_env {
        provider      = \\"predefined-generator\\"
        binaryTargets = \\"native\\"
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const platform = await getPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(platform)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual(null)

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      Object {
        "config": Object {},
        "name": "gen_env",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
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

    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen_env {
        provider      = \\"predefined-generator\\"
        binaryTargets = env(\\"BINARY_TARGETS_ENV_VAR_TEST\\")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const platform = await getPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(platform)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual('BINARY_TARGETS_ENV_VAR_TEST')

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      Object {
        "config": Object {},
        "name": "gen_env",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
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

    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen_env {
        provider      = \\"predefined-generator\\"
        binaryTargets = env(\\"BINARY_TARGETS_ENV_VAR_TEST\\")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    const generator = omit(generators[0].options!.generator, ['output'])
    const platform = await getPlatform()

    expect(generator.binaryTargets).toHaveLength(1)
    expect(generator.binaryTargets[0].value).toEqual(platform)
    expect(generator.binaryTargets[0].fromEnvVar).toEqual('BINARY_TARGETS_ENV_VAR_TEST')

    expect(omit(generator, ['binaryTargets'])).toMatchInlineSnapshot(`
      Object {
        "config": Object {},
        "name": "gen_env",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
      }
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)

    generators.forEach((g) => g.stop())
  })

  it('basic - binaryTargets as env var - darwin, windows, debian', async () => {
    process.env.BINARY_TARGETS_ENV_VAR_TEST = '["darwin", "windows", "debian-openssl-1.1.x"]'

    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen_env {
        provider      = \\"predefined-generator\\"
        binaryTargets = env(\\"BINARY_TARGETS_ENV_VAR_TEST\\")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      Object {
        "binaryTargets": Array [
          Object {
            "fromEnvVar": "BINARY_TARGETS_ENV_VAR_TEST",
            "value": "darwin",
          },
          Object {
            "fromEnvVar": "BINARY_TARGETS_ENV_VAR_TEST",
            "value": "windows",
          },
          Object {
            "fromEnvVar": "BINARY_TARGETS_ENV_VAR_TEST",
            "value": "debian-openssl-1.1.x",
          },
        ],
        "config": Object {},
        "name": "gen_env",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
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

    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema-binaryTargets-env-var.prisma'),
      providerAliases: aliases,
    })

    expect(generators.map((g) => g.manifest)).toMatchInlineSnapshot(`
      Array [
        Object {
          "defaultOutput": "default-output",
          "denylist": Array [
            "SomeForbiddenType",
          ],
          "prettyName": "This is a pretty pretty name",
          "requiresEngines": Array [
            "queryEngine",
            "migrationEngine",
          ],
        },
      ]
    `)

    expect(pick(generators[0].options!, ['datamodel', 'datasources', 'otherGenerators'])).toMatchInlineSnapshot(`
      Object {
        "datamodel": "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:./dev.db\\"
      }

      generator gen_env {
        provider      = \\"predefined-generator\\"
        binaryTargets = env(\\"BINARY_TARGETS_ENV_VAR_TEST\\")
      }

      model User {
        id   Int    @id
        name String
      }
      ",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": "sqlite",
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output'])).toMatchInlineSnapshot(`
      Object {
        "binaryTargets": Array [
          Object {
            "fromEnvVar": "BINARY_TARGETS_ENV_VAR_TEST",
            "value": "linux-musl",
          },
        ],
        "config": Object {},
        "name": "gen_env",
        "previewFeatures": Array [],
        "provider": Object {
          "fromEnvVar": null,
          "value": "predefined-generator",
        },
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

  test('inject engines', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    const migrationEngine = await resolveBinary(BinaryType.migrationEngine)

    const queryEngineBinaryType = getCliQueryEngineBinaryType()
    const queryEnginePath = await resolveBinary(queryEngineBinaryType)

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema.prisma'),
      providerAliases: aliases,
      binaryPathsOverride: {
        queryEngine: queryEnginePath,
      },
    })

    const options = generators.map((g) => g.options?.binaryPaths)

    const platform = await getPlatform()

    // we override queryEngine, so its paths should be equal to the one of the generator
    expect(options[0]?.queryEngine?.[platform]).toBe(queryEnginePath)
    // we did not override the migrationEngine, so their paths should not be equal
    expect(options[0]?.migrationEngine?.[platform]).not.toBe(migrationEngine)

    generators.forEach((g) => g.stop())
  })

  test('fail on platforms', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    await expect(
      getGenerators({
        schemaPath: path.join(__dirname, 'invalid-platforms-schema.prisma'),
        providerAliases: aliases,
      }),
    ).rejects.toThrow('deprecated')
  })

  test('fail on invalid binaryTarget', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    await expect(
      getGenerators({
        schemaPath: path.join(__dirname, 'invalid-binary-target-schema.prisma'),
        providerAliases: aliases,
      }),
    ).rejects.toThrow('Unknown')

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('fail if datasource is missing', async () => {
    expect.assertions(5)
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    try {
      await getGenerators({
        schemaPath: path.join(__dirname, 'missing-datasource-schema.prisma'),
        providerAliases: aliases,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any datasource defined in your schema.prisma.
        You can define a datasource like this:

        datasource db {
          provider = \\"postgresql\\"
          url      = env(\\"DB_URL\\")
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
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    try {
      await getGenerators({
        schemaPath: path.join(__dirname, 'missing-models-sqlite-schema.prisma'),
        providerAliases: aliases,
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
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    try {
      await getGenerators({
        schemaPath: path.join(__dirname, 'missing-models-mongodb-schema.prisma'),
        providerAliases: aliases,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        You don't have any models defined in your schema.prisma, so nothing will be generated.
        You can define a model like this:

        model User {
          id    String  @id @default(auto()) @map(\\"_id\\") @db.ObjectId
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

  test.skip('fail if dataProxy and interactiveTransactions are used together - prisma-client-js - postgres', async () => {
    expect.assertions(5)
    const aliases = {
      'predefined-generator': {
        generatorPath: generatorPath,
        outputPath: __dirname,
      },
    }

    try {
      await getGenerators({
        schemaPath: path.join(__dirname, 'proxy-and-interactiveTransactions-client-js.prisma'),
        providerAliases: aliases,
        skipDownload: true,
        dataProxy: true,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "
        The dataProxy and interactiveTransactions Preview Features can not be enabled at the same time.
        Remove interactiveTransactions from previewFeatures, for example:

        generator client {
            provider = \\"prisma-client-js\\"
            previewFeatures = [\\"dataProxy\\"]
        }

        More information in our documentation:
        https://pris.ly/d/data-proxy
        "
      `)
    }

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
