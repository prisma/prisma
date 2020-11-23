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

    const manifest = omit<any, any>(generator.manifest, ['version']) as any

    if (manifest.requiresEngineVersion.length !== 40) {
      throw new Error(
        `Generator manifest should have "requiresEngineVersion" with length 40`,
      )
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    expect(manifest).toMatchInlineSnapshot(`
      Object {
        defaultOutput: @prisma/client,
        prettyName: Prisma Client,
        requiresEngineVersion: ENGINE_VERSION_TEST,
        requiresEngines: Array [
          queryEngine,
        ],
      }
    `)

    expect(omit(generator.options!.generator, ['output']))
      .toMatchInlineSnapshot(`
      Object {
        binaryTargets: Array [],
        config: Object {},
        name: client,
        previewFeatures: Array [],
        provider: prisma-client-js,
      }
    `)

    expect(
      path.relative(__dirname, generator.options!.generator.output!),
    ).toMatchInlineSnapshot(`node_modules/@prisma/client`)

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index-browser.js'))).toBe(true)
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
        Schema parsing
        error: Error validating model "public": The model name \`public\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:10
           | 
         9 | 
        10 | model public {
        11 |   id Int @id
        12 | }
           | 
        error: Error validating model "return": The model name \`return\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
          -->  schema.prisma:14
           | 
        13 | 
        14 | model return {
        15 |   id Int @id
        16 | }
           | 

        Validation Error Count: 2
      `)
    }
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
      ).toMatchInlineSnapshot(`doesnotexist.prisma does not exist`)
    }
  })
})
