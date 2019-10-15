import { getGenerator } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { omit } from '../../omit'

jest.setTimeout(10000)

describe('generator', () => {
  test('minimal', async () => {
    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      providerAliases: {
        photonjs: path.join(__dirname, '../../../dist/generator.js'),
      },
      baseDir: __dirname,
      printDownloadProgress: false,
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
        ],
      }
    `)

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
                                    Object {
                                      "binaryTargets": Array [],
                                      "config": Object {},
                                      "name": "photon",
                                      "provider": "photonjs",
                                    }
                        `)

    expect(path.relative(__dirname, generator.options!.generator.output!)).toMatchInlineSnapshot(
      `"node_modules/@generated/photon"`,
    )

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@generated/photon')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.readdirSync(photonDir)).toMatchInlineSnapshot(`
      Array [
        "index.d.ts",
        "index.js",
        "runtime",
      ]
    `)
    generator.stop()
  })

  test('inMemory', async () => {
    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      providerAliases: {
        photonjs: path.join(__dirname, '../../../dist/generator.js'),
      },
      baseDir: __dirname,
      overrideGenerators: [
        {
          binaryTargets: [],
          config: {
            inMemory: 'true',
          },
          name: 'photon',
          provider: 'photonjs',
          output: null,
        },
      ],
    })

    const result = await generator.generate()
    expect(Object.keys(result.fileMap)).toMatchInlineSnapshot(`
            Array [
              "index.js",
              "index.d.ts",
            ]
        `)
    expect(Object.keys(result.photonDmmf)).toMatchInlineSnapshot(`
                  Array [
                    "datamodel",
                    "mappings",
                    "schema",
                  ]
            `)
    generator.stop()
  })
})
