import { getGenerator, getPackedPackage, Generator } from '@prisma/sdk'
import fs from 'fs'
import path from 'path'
import { omit } from '../../omit'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'
import rimraf from 'rimraf'
const del = promisify(rimraf)

jest.setTimeout(30000)

describe('generator', () => {
  test('minimal', async () => {
    const prismaClientTarget = path.join(
      __dirname,
      './node_modules/@prisma/client',
    )
    // Make sure, that nothing is cached.
    try {
      await del(prismaClientTarget)
    } catch (e) {
      //
    }
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
        "previewFeatures": Array [],
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

  test('denylist from engine validation', async () => {
    const prismaClientTarget = path.join(
      __dirname,
      './node_modules/@prisma/client',
    )
    // Make sure, that nothing is cached.
    try {
      await del(prismaClientTarget)
    } catch (e) {
      //
    }
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    try {
      await getGenerator({
        schemaPath: path.join(__dirname, 'denylist.prisma'),
        baseDir: __dirname,
        printDownloadProgress: false,
        skipDownload: true,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "Schema parsing
        error: Error validating model \\"public\\": The model name \`public\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:5
           | 
         4 | 
         5 | model public {
         6 |   id Int @id
         7 | }
           | 
        error: Error validating model \\"dmmf\\": The model name \`dmmf\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:9
           | 
         8 | 
         9 | model dmmf {
        10 |   id Int @id
        11 | }
           | 
        error: Error validating model \\"OnlyOne\\": The model name \`OnlyOne\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:13
           | 
        12 | 
        13 | model OnlyOne {
        14 |   id Int @id
        15 | }
           | 
        error: Error validating model \\"delete\\": The model name \`delete\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:17
           | 
        16 | 
        17 | model delete {
        18 |   id Int @id
        19 | }
           | 

        Validation Error Count: 4"
      `)
    }
  })

  test('denylist dynamic from client', async () => {
    const prismaClientTarget = path.join(
      __dirname,
      './node_modules/@prisma/client',
    )
    // Make sure, that nothing is cached.
    try {
      await del(prismaClientTarget)
    } catch (e) {
      //
    }
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'dynamic-denylist.prisma'),
      baseDir: __dirname,
      printDownloadProgress: false,
      skipDownload: true,
    })

    // Test dynamic denylist errors
    let dynamicReservedWordError
    try {
      await generator.generate()
    } catch (e) {
      dynamicReservedWordError = e
    } finally {
      expect(
        stripAnsi(dynamicReservedWordError.message).split('generation/')[1],
      ).toMatchInlineSnapshot(`
        "dynamic-denylist.prisma\\" contains reserved keywords.
               Rename the following items:
                 - \\"model UserArgs\\"
        To learn more about how to rename models, check out https://pris.ly/d/naming-models"
      `)
    }
    generator.stop()
  })

  test('schema path does not exist', async () => {
    const prismaClientTarget = path.join(
      __dirname,
      './node_modules/@prisma/client',
    )
    // Make sure, that nothing is cached.
    try {
      await del(prismaClientTarget)
    } catch (e) {
      //
    }
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    let doesnNotExistError
    try {
      await getGenerator({
        schemaPath: path.join(__dirname, 'doesnotexist.prisma'),
        baseDir: __dirname,
        printDownloadProgress: false,
        skipDownload: true,
      })
    } catch (e) {
      doesnNotExistError = e
    } finally {
      expect(
        stripAnsi(doesnNotExistError.message).split('generation/')[1],
      ).toMatchInlineSnapshot(`"doesnotexist.prisma does not exist"`)
    }
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
          previewFeatures: [],
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
