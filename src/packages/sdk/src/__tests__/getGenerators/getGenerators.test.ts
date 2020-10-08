import path from 'path'
import { getGenerators } from '../../getGenerators'
import { omit } from '../../omit'
import { pick } from '../../pick'

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
          "requiresGenerators": Array [
            "prisma-client-js",
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
              "value": "sqlite://",
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
        "provider": "predefined-generator",
      }
    `)

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
})
