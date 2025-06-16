import path from 'node:path'

import { mockMigrationAwareAdapterFactory } from '@prisma/driver-adapter-utils'
import { jestContext } from '@prisma/get-platform'
import type { ParseError } from 'effect/ParseResult'

import { defaultConfig } from '../defaultConfig'
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

  describe('no-define-config', () => {
    it('successfully loads a Prisma config file that does not use the `defineConfig` function', async () => {
      ctx.fixture('loadConfigFromFile/no-define-config')
      const cwd = ctx.fs.cwd()

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(error).toBeUndefined()
      expect(config).toMatchObject({
        earlyAccess: true,
        schema: path.join(cwd, 'schema.prisma'),
      })
    })
  })

  describe('schema', () => {
    describe('single', () => {
      it('succeeds when it points to a single Prisma schema file that exists via an absolute path', async () => {
        ctx.fixture('loadConfigFromFile/schema/single-exists')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema.prisma'),
        })
      }, 30000)

      it('succeeds when it points to a single Prisma schema file that exists via a relative path', async () => {
        ctx.fixture('loadConfigFromFile/schema/single-exists-relative')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema.prisma'),
        })
      }, 30000)

      it('succeeds when it points to a single Prisma schema file that does not exists', async () => {
        ctx.fixture('loadConfigFromFile/schema/single-does-not-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema.prisma'),
        })
      })
    })

    describe('multi', () => {
      it('succeeds when it points to multiple Prisma schema files that exist via an absolute path', async () => {
        ctx.fixture('loadConfigFromFile/schema/multi-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema'),
        })
      })

      it('succeeds when it points to multiple Prisma schema files that exist via a relative path ', async () => {
        ctx.fixture('loadConfigFromFile/schema/multi-exist-relative')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema'),
        })
      })

      it('succeeds when it points to multiple Prisma schema files that do not exist', async () => {
        ctx.fixture('loadConfigFromFile/schema/multi-do-not-exist')
        const cwd = ctx.fs.cwd()

        const { config, error, resolvedPath } = await loadConfigFromFile({})
        expect(resolvedPath).toMatch(path.join(cwd, 'prisma.config.ts'))
        expect(error).toBeUndefined()
        expect(config).toMatchObject({
          earlyAccess: true,
          loadedFromFile: resolvedPath,
          schema: path.join(cwd, 'prisma', 'schema'),
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

      const { message: errorMessage } = error.error
      const { normalisedPath } = (() => {
        if (process.platform === 'win32') {
          const actualPath = resolvedPath.replace(/\\/g, '/')
          return { normalisedPath: actualPath }
        } else {
          return { normalisedPath: resolvedPath }
        }
      })()

      expect(errorMessage).toContain('ParseError:')
      expect(errorMessage).toContain('Unexpected token')
      expect(errorMessage).toContain(normalisedPath)
    })

    it('fails with `ConfigFileParseError` when the Prisma config file has no default export', async () => {
      ctx.fixture('loadConfigFromFile/invalid/no-default-export')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorConfigFileParseError(error)
      expect(error.error.message.replaceAll(resolvedPath!, '<prisma-config>.ts')).toMatchInlineSnapshot(
        `"Expected { readonly earlyAccess: true; readonly schema?: string | undefined; readonly studio?: { readonly adapter: SqlMigrationAwareDriverAdapterFactory<Env> } | undefined; readonly migrate?: { readonly adapter?: ErrorCapturingSqlMigrationAwareDriverAdapterFactory<Env> | undefined; readonly migrationsDirectory?: string | undefined } | undefined; readonly loadedFromFile: string | null }, actual undefined"`,
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
        "{ readonly earlyAccess: true; readonly schema?: string | undefined; readonly studio?: { readonly adapter: SqlMigrationAwareDriverAdapterFactory<Env> } | undefined; readonly migrate?: { readonly adapter?: ErrorCapturingSqlMigrationAwareDriverAdapterFactory<Env> | undefined; readonly migrationsDirectory?: string | undefined } | undefined; readonly loadedFromFile: string | null }
        └─ ["thisShouldFail"]
           └─ is unexpected, expected: "earlyAccess" | "schema" | "studio" | "migrate" | "loadedFromFile""
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

    it('returns default config when the Prisma config file does not exist', async () => {
      ctx.fixture('loadConfigFromFile/default-location/ignore')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toBeNull()
      expect(error).toBeUndefined()
      expect(config).toMatchObject(defaultConfig())
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
      expect(error).toMatchObject({ _tag: 'ConfigFileNotFound' })
      expect(config).toBeUndefined()
    })

    it('succeeds when TypeScript file exists and is in a valid format', async () => {
      const customConfigPath = path.join('valid', 'prisma-config.ts')

      const { config, error, resolvedPath } = await loadConfigFromFile({
        configFile: customConfigPath,
      })
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), customConfigPath))
      expect(error).toBeUndefined()
      expect(config).toMatchObject({
        earlyAccess: true,
        loadedFromFile: resolvedPath,
      })
    })
  })

  it('typescript-cjs-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-cjs-ext-ts')
    const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')

    const { config, error, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      earlyAccess: true,
      studio: {
        adapter: expect.any(Function),
      },
      loadedFromFile: resolvedPath,
    })
    expect(error).toBeUndefined()

    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const { adapter: adapterFactory } = config.studio
    expect(adapterFactory).toBeDefined()

    // @ts-ignore
    const adapter = await adapterFactory(process.env)
    expect(JSON.stringify(adapter)).toEqual(JSON.stringify(expectedAdapter))

    expect(adapter).toBeDefined()
    expect(adapter.provider).toEqual('postgres')
  })

  it('typescript-esm-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-esm-ext-ts')
    const expectedAdapter = mockMigrationAwareAdapterFactory('postgres')

    const { config, error, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      earlyAccess: true,
      studio: {
        adapter: expect.any(Function),
      },
      loadedFromFile: resolvedPath,
    })
    expect(error).toBeUndefined()

    if (!config?.studio) {
      throw new Error('Expected config.studio to be defined')
    }

    const { adapter: adapterFactory } = config.studio
    expect(adapterFactory).toBeDefined()

    // @ts-ignore
    const adapter = await adapterFactory(process.env)
    expect(JSON.stringify(adapter)).toEqual(JSON.stringify(expectedAdapter))

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

    test('if an async custom env-var loading function is used, it should load environment variables using the provided function', async () => {
      ctx.fixture('loadConfigFromFile/env-load-esm')
      const { config, error, resolvedPath } = await loadConfigFromFile({})

      assertLoadConfigFromFileErrorIsUndefined(error)
      expect(config).toMatchObject({
        earlyAccess: true,
        loadedFromFile: resolvedPath,
      })

      expect(process.env).toMatchObject(processEnvBackup)
      expect(process.env.TEST_CONNECTION_STRING).toBeUndefined()
    })
  })
})
