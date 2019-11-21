import { getGenerator, getPackedPackage } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { omit } from '../../omit'

jest.setTimeout(10000)

describe('generator', () => {
  test('minimal', async () => {
    await getPackedPackage(
      '@prisma/photon',
      path.join(__dirname, './node_modules/@prisma/photon'),
    )

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      baseDir: __dirname,
      printDownloadProgress: false,
      skipDownload: true,
    })

    expect(generator.manifest).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "@prisma/photon",
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

    expect(omit(generator.options!.generator, ['output']))
      .toMatchInlineSnapshot(`
                                    Object {
                                      "binaryTargets": Array [],
                                      "config": Object {},
                                      "name": "photon",
                                      "provider": "photonjs",
                                    }
                        `)

    expect(
      path.relative(__dirname, generator.options!.generator.output!),
    ).toMatchInlineSnapshot(`"node_modules/@prisma/photon"`)

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@prisma/photon')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'runtime'))).toBe(true)
    generator.stop()
  })

  test('inMemory', async () => {
    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      providerAliases: {
        photonjs: {
          generatorPath: path.join(__dirname, '../../../dist/generator.js'),
          outputPath: __dirname,
        },
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
      skipDownload: true,
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
