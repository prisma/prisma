import { getGenerator, getPackedPackage } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { omit } from '../../omit'

jest.setTimeout(30000)

describe('generator', () => {
  test('minimal', async () => {
    const prismaClientTarget = path.join(
      __dirname,
      './node_modules/@prisma/client',
    )
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      baseDir: __dirname,
      printDownloadProgress: false,
      skipDownload: true,
    })

    expect(
      omit<any, any>(generator.manifest, ['version']),
    ).toMatchInlineSnapshot(`
      Object {
        "defaultOutput": "@prisma/client",
        "prettyName": "Prisma Client",
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
        "name": "client",
        "provider": "prisma-client-js",
      }
    `)

    expect(
      path.relative(__dirname, generator.options!.generator.output!),
    ).toMatchInlineSnapshot(`"node_modules/@prisma/client"`)

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'runtime'))).toBe(true)
    generator.stop()
  })

  test.skip('inMemory', async () => {
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
          name: 'client',
          provider: 'prisma-client-js',
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
