import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { confirm } from '@inquirer/prompts'
import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { HelpError } from '@prisma/internals'

import { CLI } from '../../CLI'
import { Validate } from '../../Validate'

jest.mock('@inquirer/prompts', () => ({
  confirm: jest.fn(),
}))

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
      // generate: Generate.new(),
      // version: Version.new(),
      validate: Validate.new(),
      // format: Format.new(),
      // telemetry: Telemetry.new(),
    },
    ['version', 'init', 'migrate', 'db', 'dev', 'generate', 'validate', 'format', 'telemetry'],
    download,
  )
}

function createTempProjectWithLocalPrismaBin(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-cli-local-'))
  fs.mkdirSync(path.join(tmpDir, 'node_modules', '.bin'), { recursive: true })
  fs.writeFileSync(path.join(tmpDir, 'node_modules', '.bin', 'prisma'), '', 'utf-8')
  return tmpDir
}

describe('CLI', () => {
  const download = jest.fn()
  let cliInstance: CLI
  const stdin = process.stdin as NodeJS.ReadStream & { isTTY?: boolean }
  const originalIsTTY = stdin.isTTY

  beforeEach(() => {
    cliInstance = createCLI(download)
    stdin.isTTY = true
    jest.mocked(confirm).mockReset()
  })

  afterEach(() => {
    download.mockClear()
    stdin.isTTY = originalIsTTY
  })

  describe('ensureNeededBinariesExist', () => {
    it('should download schema engine', async () => {
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

  it('requires confirmation before running the global CLI when a local Prisma binary exists', async () => {
    const tmpDir = createTempProjectWithLocalPrismaBin()
    jest.mocked(confirm).mockResolvedValueOnce(false)

    try {
      const result = await cliInstance.parse(['validate'], defaultTestConfig(), tmpDir)

      expect(result).toBeInstanceOf(HelpError)
      expect((result as HelpError).message).toContain('Use the local Prisma CLI instead')
      expect(confirm).toHaveBeenCalledTimes(1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('continues when the user explicitly confirms the global CLI', async () => {
    const tmpDir = createTempProjectWithLocalPrismaBin()
    const validateParse = jest.fn(async () => 'validated')
    const localCli = CLI.new({ validate: { parse: validateParse } as any }, [], download)
    jest.mocked(confirm).mockResolvedValueOnce(true)

    try {
      const result = await localCli.parse(['validate'], defaultTestConfig(), tmpDir)

      expect(result).toBe('validated')
      expect(validateParse).toHaveBeenCalledTimes(1)
      expect(confirm).toHaveBeenCalledTimes(1)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
