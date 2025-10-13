import { defaultTestConfig, defineConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { CLI } from '../../CLI'
import { Validate } from '../../Validate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

function createCLI(download = jest.fn()) {
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
      // dev: Dev.new(),
      // studio: Studio.new(),
      // generate: Generate.new(),
      // version: Version.new(),
      validate: Validate.new(),
      // format: Format.new(),
      // telemetry: Telemetry.new(),
    },
    ['version', 'init', 'migrate', 'db', 'dev', 'studio', 'generate', 'validate', 'format', 'telemetry'],
    download,
  )
}

describe('CLI', () => {
  const download = jest.fn()
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

    describe('with config.migrate.adapter, should not download schema-engine', () => {
      // prisma.config.ts
      const config = defineConfig({
        experimental: {
          adapter: true,
        },
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
    const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse([], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('wrong flag', async () => {
    const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse(['--something'], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('help flag', async () => {
    const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

    await cliInstance.parse(['--help'], defaultTestConfig())
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('unknown command', async () => {
    await expect(cliInstance.parse(['doesnotexist'], defaultTestConfig())).resolves.toThrow()
  })
})
