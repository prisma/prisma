import fs from 'node:fs'
import path from 'node:path'

import { omit } from '@prisma/client-common'
import {
  ClientEngineType,
  GeneratorRegistry,
  getClientEngineType,
  getGenerator,
  parseEnvValue,
} from '@prisma/internals'
import stripAnsi from 'strip-ansi'
import { describe, expect, test } from 'vitest'

import { PrismaClientTsGenerator } from '../src/generator'

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

// Non-standard `AggregateError` from `p-map` (different from standard JS AggregateError).
// We flatten it into a new error with a single message containing all the error messages
// to avoid problems with stack traces in snapshots.
expect.addSnapshotSerializer({
  test: (val) => val instanceof Error && val.name === 'AggregateError' && typeof val[Symbol.iterator] === 'function',
  serialize(val, config, indentation, depth, refs, printer) {
    const error = val as Error & Iterable<Error>
    const newError = new Error([...error].map((e) => e.message).join('\n'))
    return printer(newError, config, indentation, depth, refs)
  },
})

const registry = {
  'prisma-client-ts': {
    type: 'in-process',
    generator: new PrismaClientTsGenerator(),
  },
} satisfies GeneratorRegistry

describe('generator', () => {
  test('minimal', async () => {
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
          "defaultOutput": "./generated",
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
        "isCustomOutput": true,
        "name": "client",
        "previewFeatures": [],
        "provider": {
          "fromEnvVar": null,
          "value": "prisma-client-ts",
        },
        "sourceFilePath": "/project/schema.prisma",
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `"generated"`,
    )

    await generator.generate()
    const clientDir = path.join(__dirname, 'generated')
    expect(fs.existsSync(clientDir)).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.d.ts'))).toBe(true)
    generator.stop()
  })

  test('denylist from engine validation', async () => {
    expect.assertions(1)
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
        -->  tests/denylist.prisma:11
         | 
      10 | 
      11 | model public {
      12 |   id Int @id
      13 | }
         | 
      error: Error validating model "return": The model name \`return\` is invalid. It is a reserved name. Please change it. Read more at https://pris.ly/d/naming-models
        -->  tests/denylist.prisma:15
         | 
      14 | 
      15 | model return {
      16 |   id Int @id
      17 | }
         | 

      Validation Error Count: 2
      [Context: getDmmf]

      Prisma CLI Version : 0.0.0]
    `)
  })

  test('schema path does not exist', async () => {
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

  test('missing output path', async () => {
    await expect(async () => {
      const generator = await getGenerator({
        schemaPath: path.join(__dirname, 'missing-output.prisma'),
        printDownloadProgress: false,
        skipDownload: true,
        registry,
      })

      await generator.generate()
    }).rejects.toThrowErrorMatchingInlineSnapshot(`
      [Error: An output path is required for the \`prisma-client-ts\` generator. Please provide an output path in your schema file:

      generator client {
        provider = "prisma-client-ts"
        output   = "../src/generated"
      }

      Note: the output path is relative to the schema directory.
      ]
    `)
  })

  test('mongo', async () => {
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
          "defaultOutput": "./generated",
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
          "defaultOutput": "./generated",
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
          "value": "prisma-client-ts",
        },
        "sourceFilePath": "/project/mongo.prisma",
      }
    `)

    expect(path.relative(__dirname, parseEnvValue(generator.options!.generator.output!))).toMatchInlineSnapshot(
      `"generated"`,
    )

    await generator.generate()
    const clientDir = path.join(__dirname, 'generated')
    expect(fs.existsSync(clientDir)).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.js'))).toBe(true)
    expect(fs.existsSync(path.join(clientDir, 'index.d.ts'))).toBe(true)
    generator.stop()
  })
})
