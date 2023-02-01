import { ClientEngineType, getClientEngineType, getGenerator, getPackedPackage, parseEnvValue } from '@prisma/internals'
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import stripAnsi from 'strip-ansi'
import { promisify } from 'util'

import { omit } from '../../omit'

const del = promisify(rimraf)

if (process.env.CI) {
  jest.setTimeout(100_000)
}

describe('generator', () => {
  test('minimal', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
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
      dataProxy: false,
    })

    const manifest = omit<any, any>(generator.manifest, ['version']) as any

    if (manifest.requiresEngineVersion.length !== 40) {
      throw new Error(`Generator manifest should have "requiresEngineVersion" with length 40`)
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    if (getClientEngineType() === ClientEngineType.Library) {
      expect(manifest).toMatchInlineSnapshot(`
        {
          defaultOutput: .prisma/client,
          prettyName: Prisma Client,
          requiresEngineVersion: ENGINE_VERSION_TEST,
          requiresEngines: [
            libqueryEngine,
          ],
        }
      `)
    } else {
      expect(manifest).toMatchInlineSnapshot(`
        {
          defaultOutput: .prisma/client,
          prettyName: Prisma Client,
          requiresEngineVersion: ENGINE_VERSION_TEST,
          requiresEngines: [
            queryEngine,
          ],
        }
      `)
    }

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        binaryTargets: [],
        config: {},
        name: client,
        previewFeatures: [],
        provider: {
          fromEnvVar: null,
          value: prisma-client-js,
        },
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `node_modules/@prisma/client`,
    )

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index-browser.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'runtime'))).toBe(true)
    generator.stop()
  })

  test('denylist from engine validation', async () => {
    expect.assertions(1)
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
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
        dataProxy: false,
      })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        Prisma schema validation - (get-dmmf wasm)
        Error code: P1012
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
        [Context: getDmmf]

        Prisma CLI Version : 0.0.0
      `)
    }
  })

  test('schema path does not exist', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
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
        dataProxy: false,
      })
    } catch (e) {
      doesnNotExistError = e
    } finally {
      expect(stripAnsi(doesnNotExistError.message).split('generation' + path.sep)[1]).toMatchInlineSnapshot(
        `doesnotexist.prisma does not exist`,
      )
    }
  })

  test('override client package', async () => {
    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'main-package-override.prisma'),
      baseDir: __dirname,
      printDownloadProgress: false,
      skipDownload: true,
      dataProxy: false,
    })

    try {
      await expect(generator.generate()).rejects.toThrowErrorMatchingInlineSnapshot(`
        Generating client into /client/src/__tests__/generation/__fixture__/@prisma/client is not allowed.
        This package is used by \`prisma generate\` and overwriting its content is dangerous.

        Suggestion:
        In /client/src/__tests__/generation/main-package-override.prisma replace:

        8 output   = "./__fixture__/@prisma/client"
        with
        8 output   = "./__fixture__/.prisma/client"

        You won't need to change your imports.
        Imports from \`@prisma/client\` will be automatically forwarded to \`.prisma/client\`
      `)
    } finally {
      generator.stop()
    }
  })

  test('mongo', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
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
      schemaPath: path.join(__dirname, 'mongo.prisma'),
      baseDir: __dirname,
      printDownloadProgress: false,
      skipDownload: true,
      dataProxy: false,
    })

    const manifest = omit<any, any>(generator.manifest, ['version']) as any

    if (manifest.requiresEngineVersion.length !== 40) {
      throw new Error(`Generator manifest should have "requiresEngineVersion" with length 40`)
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    if (getClientEngineType(generator.config) === ClientEngineType.Library) {
      expect(manifest).toMatchInlineSnapshot(`
        {
          defaultOutput: .prisma/client,
          prettyName: Prisma Client,
          requiresEngineVersion: ENGINE_VERSION_TEST,
          requiresEngines: [
            libqueryEngine,
          ],
        }
      `)
    } else {
      expect(manifest).toMatchInlineSnapshot(`
        {
          defaultOutput: .prisma/client,
          prettyName: Prisma Client,
          requiresEngineVersion: ENGINE_VERSION_TEST,
          requiresEngines: [
            queryEngine,
          ],
        }
      `)
    }

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        binaryTargets: [],
        config: {},
        name: client,
        previewFeatures: [],
        provider: {
          fromEnvVar: null,
          value: prisma-client-js,
        },
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `node_modules/@prisma/client`,
    )

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/@prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index-browser.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'runtime'))).toBe(true)
    generator.stop()
  })
})
