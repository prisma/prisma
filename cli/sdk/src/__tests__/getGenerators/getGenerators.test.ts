import path from 'path'
import { getGenerators, getGenerator } from '../../getGenerators'
import { pick } from '../../pick'

describe('getGenerators', () => {
  test('basic', async () => {
    const aliases = {
      'predefined-generator': path.join(__dirname, 'generator'),
    }

    const generators = await getGenerators({
      schemaPath: path.join(__dirname, 'valid-minimal-schema.prisma'),
      aliases,
    })

    expect(generators.map(g => g.manifest)).toMatchInlineSnapshot(`
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
            "photonjs",
          ],
        },
      ]
    `)

    expect(
      pick(generators[0].options!, [
        'generator',
        'datamodel',
        'datasources',
        'otherGenerators',
      ]),
    ).toMatchInlineSnapshot(`
      Object {
        "datamodel": "generator gen {
        provider      = \\"predefined-generator\\"
        binaryTargets = [\\"darwin\\"]
      }

      model User {
        id   Int    @id
        name String
      }",
        "datasources": Array [],
        "generator": Object {
          "binaryTargets": Array [
            "darwin",
          ],
          "config": Object {},
          "name": "gen",
          "output": null,
          "provider": "predefined-generator",
        },
        "otherGenerators": Array [],
      }
    `)
  })

  test('fail on platforms', async () => {
    const aliases = {
      'predefined-generator': path.join(__dirname, 'generator'),
    }

    expect(
      getGenerators({
        schemaPath: path.join(__dirname, 'invalid-platforms-schema.prisma'),
        aliases,
      }),
    ).rejects.toThrow('deprecated')
  })

  test('fail on invalid binaryTarget', async () => {
    const aliases = {
      'predefined-generator': path.join(__dirname, 'generator'),
    }

    expect(
      getGenerators({
        schemaPath: path.join(__dirname, 'invalid-binary-target-schema.prisma'),
        aliases,
      }),
    ).rejects.toThrow('Unknown')
  })
})
