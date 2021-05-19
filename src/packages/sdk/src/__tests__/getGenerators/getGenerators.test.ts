import path from 'path'
import { getGenerators } from '../../getGenerators'
import { omit } from '../../omit'
import { pick } from '../../pick'
import { resolveBinary } from '../../resolveBinary'
import { getPlatform } from '@prisma/get-platform'
import stripAnsi from 'strip-ansi'
import { EngineTypes } from '@prisma/fetch-engine'

jest.setTimeout(20000)

describe('getGenerators', () => {
  test('basic', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: path.join(__dirname, 'generator'),
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

    expect(
      pick(generators[0].options!, [
        'datamodel',
        'datasources',
        'otherGenerators',
      ]),
    ).toMatchInlineSnapshot(`
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
      }",
        "datasources": Array [
          Object {
            "activeProvider": "sqlite",
            "name": "db",
            "provider": Array [
              "sqlite",
            ],
            "url": Object {
              "fromEnvVar": null,
              "value": "file:./dev.db",
            },
          },
        ],
        "otherGenerators": Array [],
      }
    `)

    expect(omit(generators[0].options!.generator, ['output']))
      .toMatchInlineSnapshot(`
      Object {
        "binaryTargets": Array [
          "darwin",
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

  test('inject engines', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: path.join(__dirname, 'generator'),
        outputPath: __dirname,
      },
    }

    const migrationEngine = await resolveBinary(EngineTypes.migrationEngine)
    const queryEngine = await resolveBinary(EngineTypes.queryEngine)

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema.prisma'),
      providerAliases: aliases,
      binaryPathsOverride: {
        queryEngine,
      },
    })

    const options = generators.map((g) => g.options?.binaryPaths)

    const platform = await getPlatform()

    // we override queryEngine, so its paths should be equal to the one of the generator
    expect(options[0]?.queryEngine?.[platform]).toBe(queryEngine)
    // we did not override the migrationEngine, so their paths should not be equal
    expect(options[0]?.migrationEngine?.[platform]).not.toBe(migrationEngine)

    generators.forEach((g) => g.stop())
  })

  test('fail on platforms', async () => {
    const aliases = {
      'predefined-generator': {
        generatorPath: path.join(__dirname, 'generator'),
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
        generatorPath: path.join(__dirname, 'generator'),
        outputPath: __dirname,
      },
    }

    await expect(
      getGenerators({
        schemaPath: path.join(__dirname, 'invalid-binary-target-schema.prisma'),
        providerAliases: aliases,
      }),
    ).rejects.toThrow('Unknown')
  })

  test('fail if datasource is missing', async () => {
    expect.assertions(1)
    const aliases = {
      'predefined-generator': {
        generatorPath: path.join(__dirname, 'generator'),
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
  })
})
