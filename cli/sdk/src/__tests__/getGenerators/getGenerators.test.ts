import path from 'path'
import { getGenerators } from '../../getGenerators'
import { pick } from '../../pick'

describe('getGenerators', () => {
  test('basic', async () => {
    const aliases = {
      'predefined-generator': path.join(__dirname, 'generator'),
    }

    const generators = await getGenerators(
      path.join(__dirname, 'schema.prisma'),
      aliases,
    )

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
      pick(generators[0].options, [
        'generator',
        'datamodel',
        'datasources',
        'otherGenerators',
      ]),
    ).toMatchInlineSnapshot(`
      Object {
        "datamodel": "generator gen {
        provider  = \\"predefined-generator\\"
        platforms = [\\"darwin\\"]
      }

      model User {
        id   Int    @id
        name String
      }",
        "datasources": Array [],
        "generator": Object {
          "binaryTargets": Array [],
          "config": Object {
            "platforms": "(array)",
          },
          "name": "gen",
          "output": null,
          "provider": "predefined-generator",
        },
        "otherGenerators": Array [],
      }
    `)
  })
})
