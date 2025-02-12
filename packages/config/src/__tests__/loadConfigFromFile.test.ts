import path from 'node:path'

import { jestContext } from '@prisma/get-platform'
import type { ParseError } from 'effect/ParseResult'

import { loadConfigFromFile, type LoadConfigFromFileError } from '../loadConfigFromFile'

const ctx = jestContext.new().assemble()

describe('loadConfigFromFile', () => {
  function assertErrorTypeScriptImportFailed(error: LoadConfigFromFileError | undefined): asserts error is {
    _tag: 'TypeScriptImportFailed'
    error: Error
  } {
    expect(error).toMatchObject({ _tag: 'TypeScriptImportFailed' })
  }

  function assertErrorConfigFileParseError(error: LoadConfigFromFileError | undefined): asserts error is {
    _tag: 'ConfigFileParseError'
    error: ParseError
  } {
    expect(error).toMatchObject({ _tag: 'ConfigFileParseError' })
  }

  describe('schema', () => {
    describe('single', () => {
      it('loads a single Prisma schema file from the filesystem when it exists', async () => {
        ctx.fixture('loadConfigFromFile/schema/single-exists')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: {
            kind: 'single',
            getPSLSchema: expect.any(Function),
          },
        })
        expect(error).toBeUndefined()

        if (!config?.schema) {
          throw new Error('Expected config.schema to be defined')
        }

        const pslSchemaResult = await config.schema.getPSLSchema()

        expect(pslSchemaResult).toMatchObject({
          schemaPath: path.join(cwd, 'prisma', 'schema.prisma'),
          schemaRootDir: path.join(cwd, 'prisma'),
        })
        expect(pslSchemaResult.schemas).toHaveLength(1)

        expect(pslSchemaResult.schemas[0][0 /* filePath */]).toEqual('schema.prisma')
        expect(pslSchemaResult.schemas[0][1 /* content */]).toMatchInlineSnapshot(`
          "generator client {
              provider        = "prisma-client-js"
              previewFeatures = ["prismaSchemaFolder"]
          }
          "
        `)
      })

      it('fails to load a single Prisma schema file from the filesystem when it does not exists', async () => {
        ctx.fixture('loadConfigFromFile/schema/single-does-not-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: {
            kind: 'single',
            getPSLSchema: expect.any(Function),
          },
        })
        expect(error).toBeUndefined()

        if (!config?.schema) {
          throw new Error('Expected config.schema to be defined')
        }

        await expect(config.schema.getPSLSchema()).rejects.toMatchObject({
          code: 'ENOENT',
          errno: -2,
          path: path.join(cwd, 'prisma', 'schema.prisma'),
        })
      })
    })

    describe('multi', () => {
      it('loads multiple Prisma schema files from the filesystem when they exist', async () => {
        ctx.fixture('loadConfigFromFile/schema/multi-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: {
            kind: 'multi',
            getPSLSchema: expect.any(Function),
          },
        })
        expect(error).toBeUndefined()

        if (!config?.schema) {
          throw new Error('Expected config.schema to be defined')
        }

        const pslSchemaResult = await config.schema.getPSLSchema()

        expect(pslSchemaResult).toMatchObject({
          schemaPath: path.join(cwd, 'prisma', 'schema'),
          schemaRootDir: path.join(cwd, 'prisma', 'schema'),
        })
        expect(pslSchemaResult.schemas).toHaveLength(2)

        expect(pslSchemaResult.schemas[0][0 /* filePath */]).toEqual(path.join(cwd, 'prisma', 'schema', 'a.prisma'))
        expect(pslSchemaResult.schemas[0][1 /* content */]).toMatchInlineSnapshot(`
          "// a.prisma
          "
        `)

        expect(pslSchemaResult.schemas[1][0 /* filePath */]).toEqual(path.join(cwd, 'prisma', 'schema', 'b.prisma'))
        expect(pslSchemaResult.schemas[1][1 /* content */]).toMatchInlineSnapshot(`
          "// b.prisma
          "
        `)
      })

      it('fails to load multiple Prisma schema files from the filesystem when they do not exists', async () => {
        ctx.fixture('loadConfigFromFile/schema/multi-do-not-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: {
            kind: 'multi',
            getPSLSchema: expect.any(Function),
          },
        })
        expect(error).toBeUndefined()

        if (!config?.schema) {
          throw new Error('Expected config.schema to be defined')
        }

        await expect(config.schema.getPSLSchema()).rejects.toMatchObject({
          code: 'ENOENT',
          errno: -2,
          path: path.join(cwd, 'prisma', 'schema'),
        })
      })
    })
  })

  describe('invalid', () => {
    it('fails with `TypeScriptImportFailed` when the Prisma config file has a syntax error', async () => {
      ctx.fixture('loadConfigFromFile/invalid/syntax-error')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorTypeScriptImportFailed(error)
      expect(error.error.message.replaceAll(resolvedPath!, '<prisma-config>.ts')).toMatchInlineSnapshot(`
        "  [31m×[0m Unexpected eof
           ╭─[[36;1;4m<prisma-config>.ts[0m:5:3]
         [2m3[0m │ export default defineConfig({
         [2m4[0m │   earlyAccess: true,
         [2m5[0m │ }
           ╰────


        Caused by:
            Syntax Error"
      `)
    })

    it('fails with `ConfigFileParseError` when the Prisma config file has no default export', async () => {
      ctx.fixture('loadConfigFromFile/invalid/no-default-export')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorConfigFileParseError(error)
      expect(error.error.message.replaceAll(resolvedPath!, '<prisma-config>.ts')).toMatchInlineSnapshot(
        `"Expected { readonly earlyAccess: true; readonly schema?: { readonly getPSLSchema: GetPSLSchema; readonly kind: "single" | "multi" } | undefined; readonly studio?: { readonly createAdapter: CreateAdapter<Env> } | undefined; readonly loadedFromFile: string | null }, actual undefined"`,
      )
    })

    it(`fails with \`ConfigFileParseError\` when the default export in the Prisma config file does
        not conform to the expected schema shape`, async () => {
      ctx.fixture('loadConfigFromFile/invalid/no-schema-shape-conformance')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorConfigFileParseError(error)
      expect(error.error.message.replaceAll(resolvedPath!, '<prisma-config>.ts')).toMatchInlineSnapshot(`
        "{ readonly earlyAccess: true; readonly schema?: { readonly getPSLSchema: GetPSLSchema; readonly kind: "single" | "multi" } | undefined; readonly studio?: { readonly createAdapter: CreateAdapter<Env> } | undefined; readonly loadedFromFile: string | null }
        └─ ["thisShouldFail"]
           └─ is unexpected, expected: "earlyAccess" | "schema" | "studio" | "loadedFromFile""
      `)
    })
  })

  describe('default-location', () => {
    it('succeeds when the Prisma config file exists and is in a valid format', async () => {
      ctx.fixture('loadConfigFromFile/default-location/success')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toMatchObject({
        earlyAccess: true,
        loadedFromFile: resolvedPath,
      })
      expect(error).toBeUndefined()
    })

    it('returns no config when the Prisma config file does not exist', async () => {
      ctx.fixture('loadConfigFromFile/default-location/ignore')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toBeNull()
      expect(config).toBeUndefined()
      expect(error).toBeUndefined()
    })
  })

  describe('custom-location', () => {
    beforeEach(() => {
      ctx.fixture('loadConfigFromFile/custom-location')
    })

    it('fails when the given file does not exist', async () => {
      const customConfigPath = path.join('does', 'not', 'exist.ts')

      const { config, error, resolvedPath } = await loadConfigFromFile({
        configFile: customConfigPath,
      })
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), customConfigPath))
      expect(config).toBeUndefined()
      expect(error).toMatchObject({ _tag: 'ConfigFileNotFound' })
    })

    it('succeeds when TypeScript file exists and is in a valid format', async () => {
      const customConfigPath = path.join('valid', 'prisma-config.ts')

      const { config, error, resolvedPath } = await loadConfigFromFile({
        configFile: customConfigPath,
      })
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), customConfigPath))
      expect(config).toMatchObject({
        earlyAccess: true,
        loadedFromFile: resolvedPath,
      })
      expect(error).toBeUndefined()
    })
  })

  it('typescript-cjs-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-cjs-ext-ts')

    const { config, error, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      earlyAccess: true,
      studio: {
        createAdapter: expect.any(Function),
      },
      loadedFromFile: resolvedPath,
    })
    expect(error).toBeUndefined()

    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const adapter = await config.studio.createAdapter({})
    expect(adapter).toBeDefined()
    expect(adapter.provider).toEqual('postgres')
  })

  it('typescript-esm-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-esm-ext-ts')

    const { config, error, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      earlyAccess: true,
      studio: {
        createAdapter: expect.any(Function),
      },
      loadedFromFile: resolvedPath,
    })
    expect(error).toBeUndefined()

    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const adapter = await config.studio.createAdapter({})
    expect(adapter).toBeDefined()
    expect(adapter.provider).toEqual('postgres')
  })

  describe('environment variables', () => {
    let processEnvBackup: NodeJS.ProcessEnv

    beforeEach(() => {
      processEnvBackup = { ...process.env }
    })

    afterEach(() => {
      process.env = processEnvBackup
    })

    function assertLoadConfigFromFileErrorIsUndefined(
      error: LoadConfigFromFileError | undefined,
    ): asserts error is undefined {
      expect(error).toBeUndefined()
    }

    test('if no custom env-var loading function is imported, it should skip loading any environment variables', async () => {
      ctx.fixture('loadConfigFromFile/env-baseline')
      const { config, error } = await loadConfigFromFile({})
      assertLoadConfigFromFileErrorIsUndefined(error)
      expect(config).toMatchObject({
        earlyAccess: true,
      })

      expect(process.env).toMatchObject(processEnvBackup)
      expect(process.env.TEST_CONNECTION_STRING).toBeUndefined()
    })

    test('if a sync custom env-var loading function is imported, it should load environment variables using the provided function', async () => {
      ctx.fixture('loadConfigFromFile/env-load-cjs')
      const { config, error } = await loadConfigFromFile({})
      assertLoadConfigFromFileErrorIsUndefined(error)
      expect(config).toMatchObject({
        earlyAccess: true,
      })

      expect(process.env).toMatchObject({
        ...processEnvBackup,
        TEST_CONNECTION_STRING: 'postgres://test-connection-string-from-env',
      })
    })

    test('if an async custom env-var loading function is used, it should fail loading environment variables using the provided function', async () => {
      ctx.fixture('loadConfigFromFile/env-load-esm')
      const { config, error } = await loadConfigFromFile({})

      expect(config).toBeUndefined()
      assertErrorTypeScriptImportFailed(error)
      expect(error).toMatchObject({ _tag: 'TypeScriptImportFailed' })
      expect(error.error).toMatchInlineSnapshot(
        `[SyntaxError: await is only valid in async functions and the top level bodies of modules]`,
      )

      expect(process.env).toMatchObject(processEnvBackup)
      expect(process.env.TEST_CONNECTION_STRING).toBeUndefined()
    })
  })
})
