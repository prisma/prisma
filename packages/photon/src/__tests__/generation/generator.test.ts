import { getGenerator } from '@prisma/sdk'
import path from 'path'

describe('generator', () => {
  test('minimal', async () => {
    const generator = await getGenerator(path.join(__dirname, 'schema.prisma'), {
      photonjs: path.join(__dirname, '../../generator.ts'),
    })

    expect(generator.manifest).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "node_modules/@generated/photon",
        "denylists": Object {
          "fields": Array [
            "AND",
            "OR",
            "NOT",
          ],
          "models": Array [
            "Enumerable",
            "MergeTruthyValues",
            "CleanupNever",
            "AtLeastOne",
            "OnlyOne",
            "StringFilter",
            "IDFilter",
            "FloatFilter",
            "IntFilter",
            "BooleanFilter",
            "DateTimeFilter",
            "NullableStringFilter",
            "NullableIDFilter",
            "NullableFloatFilter",
            "NullableIntFilter",
            "NullableBooleanFilter",
            "NullableDateTimeFilter",
            "PhotonFetcher",
            "Photon",
            "Engine",
            "PhotonOptions",
          ],
        },
        "prettyName": "Photon.js",
        "requiresEngines": Array [
          "queryEngine",
          "migrationEngine",
        ],
      }
    `)
  })
})
