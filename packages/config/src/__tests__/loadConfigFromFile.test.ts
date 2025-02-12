import path from 'node:path'

import { jestContext } from '@prisma/get-platform'

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
    error: Error
  } {
    expect(error).toMatchObject({ _tag: 'ConfigFileParseError' })
  }

  describe('invalid', () => {
    it('fails when the Prisma config file has a syntax error', async () => {
      ctx.fixture('loadConfigFromFile/invalid/syntax-error')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorTypeScriptImportFailed(error)
      expect(error.error.message.replaceAll(resolvedPath!, '<prisma-config>.ts')).toMatchInlineSnapshot(`
        "  [31m×[0m Unexpected eof
           ╭─[[36;1;4m<prisma-config>.ts[0m:5:3]
         [2m3[0m │ export default defineConfig({
         [2m4[0m │   experimental: true,
         [2m5[0m │ }
           ╰────


        Caused by:
            Syntax Error"
      `)
    })

    it('fails when the Prisma config file has no default export', async () => {
      ctx.fixture('loadConfigFromFile/invalid/no-default-export')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toBeUndefined()
      assertErrorConfigFileParseError(error)
    })
  })

  describe('default-location', () => {
    it('succeeds when the Prisma config file exists and is in a valid format', async () => {
      ctx.fixture('loadConfigFromFile/default-location/success')

      const { config, error, resolvedPath } = await loadConfigFromFile({})
      expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
      expect(config).toMatchObject({
        experimental: true,
        loadedFromFile: path.join(ctx.fs.cwd(), 'prisma.config.ts'),
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
        experimental: true,
        loadedFromFile: path.join(ctx.fs.cwd(), customConfigPath),
      })
      expect(error).toBeUndefined()
    })
  })

  it('typescript-cjs-ext-ts', async () => {
    ctx.fixture('loadConfigFromFile/typescript-cjs-ext-ts')

    const { config, error, resolvedPath } = await loadConfigFromFile({})
    expect(resolvedPath).toMatch(path.join(ctx.fs.cwd(), 'prisma.config.ts'))
    expect(config).toMatchObject({
      experimental: true,
      studio: {
        createAdapter: expect.any(Function),
      },
      loadedFromFile: path.join(ctx.fs.cwd(), 'prisma.config.ts'),
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
      experimental: true,
      studio: {
        createAdapter: expect.any(Function),
      },
      loadedFromFile: path.join(ctx.fs.cwd(), 'prisma.config.ts'),
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
        experimental: true,
      })

      expect(process.env).toMatchObject(processEnvBackup)
      expect(process.env.TEST_CONNECTION_STRING).toBeUndefined()
    })

    test('if a sync custom env-var loading function is imported, it should load environment variables using the provided function', async () => {
      ctx.fixture('loadConfigFromFile/env-load-cjs')
      const { config, error } = await loadConfigFromFile({})
      assertLoadConfigFromFileErrorIsUndefined(error)
      expect(config).toMatchObject({
        experimental: true,
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
