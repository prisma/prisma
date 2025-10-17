import { defaultTestConfig, defineConfig } from '@prisma/config'
import { vitestConsoleContext, vitestContext } from '@prisma/get-platform/src/test-utils/vitestContext'
import { DbPull } from '@prisma/migrate'
import { vi } from 'vitest'

import { CLI } from '../../CLI'
import { Validate } from '../../Validate'

const ctx = vitestContext.new().add(vitestConsoleContext()).assemble()

function createCLI(download = vi.fn()) {
  return CLI.new(
    {
      // init: Init.new(),
      // migrate: MigrateCommand.new({
      //   diff: MigrateDiff.new(),
      //   dev: MigrateDev.new(),
      //   status: MigrateStatus.new(),
      //   resolve: MigrateResolve.new(),
      //   reset: MigrateReset.new(),
      //   deploy: MigrateDeploy.new(),
      // }),
      // db: DbCommand.new({
      //   pull: DbPull.new(),
      //   push: DbPush.new(),
      //   // drop: DbDrop.new(),
      //   seed: DbSeed.new(),
      // }),
      /**
       * @deprecated since version 2.30.0, use `db pull` instead (renamed)
       */
      introspect: DbPull.new(),
      // dev: Dev.new(),
      // studio: Studio.new(),
      // generate: Generate.new(),
      // version: Version.new(),
      validate: Validate.new(),
      // format: Format.new(),
      // telemetry: Telemetry.new(),
    },
    ['version', 'init', 'migrate', 'db', 'introspect', 'dev', 'studio', 'generate', 'validate', 'format', 'telemetry'],
    download,
  )
}

describe('CLI', () => {
  const download = vi.fn()
  let cliInstance: CLI

  beforeEach(() => {
    cliInstance = createCLI(download)
  })

  afterEach(() => {
    download.mockClear()
  })

  describe('ensureNeededBinariesExist', () => {
    const originalEnv = process.env
    process.env = { ...originalEnv }

    beforeAll(() => {
      process.env = {
        ...originalEnv,
        PRISMA_CLI_QUERY_ENGINE_TYPE: undefined,
        PRISMA_CLIENT_ENGINE_TYPE: undefined,
      }
    })

    afterAll(() => {
      process.env = { ...originalEnv }
    })

    describe('with `config.migrate.engine === "js"`, should not download schema-engine', () => {
      // prisma.config.ts
      const config = defineConfig({
        experimental: {
          adapter: true,
        },
        engine: 'js',
        // @ts-ignore: we don't need to import an actual adapter
        adapter: async () => {
          return Promise.resolve({})
        },
      })

      it('should not download query-engine when engineType = "client"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-compiler.prisma'], config)
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {},
          }),
        )
      })

      it('should download query-engine when engineType = "library"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-engine-library.prisma'], config)
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'libquery-engine': expect.any(String),
            },
          }),
        )
      })

      it('should download query-engine when engineType = "binary"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-engine-binary.prisma'], config)

        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'query-engine': expect.any(String),
            },
          }),
        )
      })
    })

    describe('without config.migrate.adapter, should download schema-engine', () => {
      it('should not download query-engine when engineType = "client"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-compiler.prisma'], defaultTestConfig())
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'schema-engine': expect.any(String),
            },
          }),
        )
      })

      it('should download query-engine when engineType = "library"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-engine-library.prisma'], defaultTestConfig())
        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'libquery-engine': expect.any(String),
              'schema-engine': expect.any(String),
            },
          }),
        )
      })

      it('should download query-engine when engineType = "binary"', async () => {
        ctx.fixture('ensure-needed-binaries-exist')

        await cliInstance.parse(['validate', '--schema', './using-query-engine-binary.prisma'], defaultTestConfig())

        expect(download).toHaveBeenCalledWith(
          expect.objectContaining({
            binaries: {
              'query-engine': expect.any(String),
              'schema-engine': expect.any(String),
            },
          }),
        )
      })
    })
  })

  it('no params should return help', async () => {
    const spy = vi.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse([], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('wrong flag', async () => {
    const spy = vi.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse(['--something'], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('help flag', async () => {
    const spy = vi.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse(['--help'], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('unknown command', async () => {
    await expect(cliInstance.parse(['doesnotexist'], defaultTestConfig())).resolves.toThrow()
  })

  it('introspect should include deprecation warning', async () => {
    const result = cliInstance.parse(['introspect'], defaultTestConfig())

    await expect(result).rejects.toMatchInlineSnapshot(`
      "Could not find a schema.prisma file that is required for this command.
      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location"
    `)
    expect(ctx.mocked['console.log'].mock.calls).toHaveLength(0)
    expect(ctx.mocked['console.info'].mock.calls).toHaveLength(0)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "prisma:warn 
      prisma:warn The prisma introspect command is deprecated. Please use prisma db pull instead.
      prisma:warn "
    `)
    expect(ctx.mocked['console.error'].mock.calls).toHaveLength(0)
  })
})
