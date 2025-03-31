import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'

import { omit } from '@prisma/client-common'
import {
  ClientEngineType,
  GeneratorRegistry,
  getClientEngineType,
  getGenerator,
  getPackedPackage,
  parseEnvValue,
} from '@prisma/internals'
import stripAnsi from 'strip-ansi'
import { describe, expect, test, vi } from 'vitest'

import { PrismaClientJsGenerator } from '../src/generator'

function addSnapshotPathSanitizer({
  test,
  get,
  set,
}: {
  test: (value: unknown) => boolean
  get: (value: unknown) => string
  set: (value: unknown, sanitized: string) => unknown
}) {
  expect.addSnapshotSerializer({
    test: (val) => test(val) && (get(val).includes(__dirname) || get(val).includes('\\')),
    serialize(val, config, indentation, depth, refs, printer) {
      const newStr = get(val).replaceAll(__dirname, '/project').replaceAll('\\', '/')
      return printer(set(val, newStr), config, indentation, depth, refs)
    },
  })
}

addSnapshotPathSanitizer({
  test: (value: unknown) => typeof value === 'string',
  get: (val) => val as string,
  set: (_, sanitized) => sanitized,
})

addSnapshotPathSanitizer({
  test: (value: unknown) => value instanceof Error,
  get: (val) => (val as Error).message,
  set: (val, sanitized) => {
    const error = val as Error
    error.message = sanitized
    return error
  },
})

expect.addSnapshotSerializer({
  test(val) {
    if (typeof val !== 'object' || val == null) {
      return false
    }
    if (!('fromEnvVar' in val && 'native' in val && 'value' in val)) {
      return false
    }
    return val.native === true && val.value !== 'NATIVE_BINARY_TARGET'
  },
  serialize(val, config, indentation, depth, refs, printer) {
    const newVal = { ...val, value: 'NATIVE_BINARY_TARGET' }
    return printer(newVal, config, indentation, depth, refs)
  },
})

expect.addSnapshotSerializer({
  test: (val) => val instanceof Error && val.message.includes('\x1B'),
  serialize(val, config, indentation, depth, refs, printer) {
    val.message = stripAnsi((val as Error).message)
    return printer(val, config, indentation, depth, refs)
  },
})

const registry = {
  'prisma-client-js': {
    type: 'in-process',
    generator: new PrismaClientJsGenerator(),
  },
} satisfies GeneratorRegistry

describe('generator', () => {
  test('minimal', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
    // Make sure, that nothing is cached.
    await fsPromises.rm(prismaClientTarget, { recursive: true, force: true })
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema.prisma'),
      printDownloadProgress: false,
      skipDownload: true,
      registry,
    })

    const manifest = omit(generator.manifest!, ['version'])

    if (manifest.requiresEngineVersion?.length !== 40) {
      throw new Error(`Generator manifest should have "requiresEngineVersion" with length 40`)
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    if (getClientEngineType() === ClientEngineType.Library) {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": "/project/node_modules/@prisma/client",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "libqueryEngine",
          ],
        }
      `)
    } else {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": "/project/node_modules/@prisma/client",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "queryEngine",
          ],
        }
      `)
    }

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "native": true,
            "value": "NATIVE_BINARY_TARGET",
          },
        ],
        "config": {},
        "name": "client",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "prisma-client-js",
        },
        "sourceFilePath": "/project/schema.prisma",
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `"node_modules/@prisma/client"`,
    )

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/.prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index-browser.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    generator.stop()

    expect(warn.mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Warning: You did not specify an output path for your \`generator\` in schema.prisma. This behavior is deprecated and will no longer be supported in Prisma 7.0.0. To learn more visit https://pris.ly/cli/output-path",
        ],
      ]
    `)
  })

  test('with custom output', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
    await fsPromises.rm(prismaClientTarget, { recursive: true, force: true })
    await fsPromises.cp(path.join(__dirname, '../../client/runtime'), path.join(prismaClientTarget, 'runtime'), {
      recursive: true,
    })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'schema-with-custom-output.prisma'),
      printDownloadProgress: false,
      skipDownload: true,
      registry,
    })

    const manifest = omit(generator.manifest!, ['version'])

    if (manifest.requiresEngineVersion?.length !== 40) {
      throw new Error(`Generator manifest should have "requiresEngineVersion" with length 40`)
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    if (getClientEngineType() === ClientEngineType.Library) {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": "/project/node_modules/@prisma/client",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "libqueryEngine",
          ],
        }
      `)
    } else {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": "/project/generated",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "queryEngine",
          ],
        }
      `)
    }

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "native": true,
            "value": "NATIVE_BINARY_TARGET",
          },
        ],
        "config": {},
        "isCustomOutput": true,
        "name": "client",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "prisma-client-js",
        },
        "sourceFilePath": "/project/schema-with-custom-output.prisma",
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `"generated"`,
    )

    await generator.generate()
    const clientDir = path.join(__dirname, 'generated')
    expect(fs.existsSync(clientDir)).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index-browser.js'))).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.d.ts'))).toBe(true)
    generator.stop()

    expect(warn).not.toHaveBeenCalled()
  })

  test('denylist from engine validation', async () => {
    expect.assertions(1)
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
    // Make sure, that nothing is cached.
    await fsPromises.rm(prismaClientTarget, { recursive: true, force: true })
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    await expect(async () => {
      await getGenerator({
        schemaPath: path.join(__dirname, 'denylist.prisma'),
        printDownloadProgress: false,
        skipDownload: true,
        registry,
      })
    }).rejects.toThrowErrorMatchingInlineSnapshot(`
      [GetDmmfError: Prisma schema validation - (get-dmmf wasm)
      Error code: P1012
      error: Error validating model "public": The model name \`public\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
        -->  tests/denylist.prisma:10
         | 
       9 | 
      10 | model public {
      11 |   id Int @id
      12 | }
         | 
      error: Error validating model "return": The model name \`return\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
        -->  tests/denylist.prisma:14
         | 
      13 | 
      14 | model return {
      15 |   id Int @id
      16 | }
         | 

      Validation Error Count: 2
      [Context: getDmmf]

      Prisma CLI Version : 0.0.0]
    `)
  })

  test('schema path does not exist', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
    // Make sure, that nothing is cached.
    await fsPromises.rm(prismaClientTarget, { recursive: true, force: true })
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    await expect(async () => {
      await getGenerator({
        schemaPath: path.join(__dirname, 'doesnotexist.prisma'),
        printDownloadProgress: false,
        skipDownload: true,
        registry,
      })
    }).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: Could not load \`--schema\` from provided path \`tests/doesnotexist.prisma\`: file or directory not found]`,
    )
  })

  test('override client package', async () => {
    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'main-package-override.prisma'),
      printDownloadProgress: false,
      skipDownload: true,
      registry,
    })

    await expect(generator.generate()).rejects.toThrowErrorMatchingInlineSnapshot(`
      [Error: Generating client into /project/__fixture__/@prisma/client is not allowed.
      This package is used by \`prisma generate\` and overwriting its content is dangerous.

      Suggestion:
      In /project/main-package-override.prisma replace:

      8 output   = "./__fixture__/@prisma/client"
      with
      8 output   = "./__fixture__/.prisma/client"

      You won't need to change your imports.
      Imports from \`@prisma/client\` will be automatically forwarded to \`.prisma/client\`]
    `)
  })

  test('mongo', async () => {
    const prismaClientTarget = path.join(__dirname, './node_modules/@prisma/client')
    // Make sure, that nothing is cached.
    await fsPromises.rm(prismaClientTarget, { recursive: true, force: true })
    await getPackedPackage('@prisma/client', prismaClientTarget)

    if (!fs.existsSync(prismaClientTarget)) {
      throw new Error(`Prisma Client didn't get packed properly 🤔`)
    }

    const generator = await getGenerator({
      schemaPath: path.join(__dirname, 'mongo.prisma'),
      printDownloadProgress: false,
      skipDownload: true,
      registry,
    })

    const manifest = omit(generator.manifest!, ['version'])

    if (manifest.requiresEngineVersion?.length !== 40) {
      throw new Error(`Generator manifest should have "requiresEngineVersion" with length 40`)
    }
    manifest.requiresEngineVersion = 'ENGINE_VERSION_TEST'

    if (getClientEngineType(generator.config) === ClientEngineType.Library) {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": "/project/node_modules/@prisma/client",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "libqueryEngine",
          ],
        }
      `)
    } else {
      expect(manifest).toMatchInlineSnapshot(`
        {
          "defaultOutput": ".prisma/client",
          "prettyName": "Prisma Client",
          "requiresEngineVersion": "ENGINE_VERSION_TEST",
          "requiresEngines": [
            "queryEngine",
          ],
        }
      `)
    }

    expect(omit(generator.options!.generator, ['output'])).toMatchInlineSnapshot(`
      {
        "binaryTargets": [
          {
            "fromEnvVar": null,
            "native": true,
            "value": "NATIVE_BINARY_TARGET",
          },
        ],
        "config": {},
        "name": "client",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "prisma-client-js",
        },
        "sourceFilePath": "/project/mongo.prisma",
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `"node_modules/@prisma/client"`,
    )

    await generator.generate()
    const photonDir = path.join(__dirname, 'node_modules/.prisma/client')
    expect(fs.existsSync(photonDir)).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index-browser.js'))).toBe(true)
    expect(fs.existsSync(path.join(photonDir, 'index.d.ts'))).toBe(true)
    generator.stop()
  })
})
