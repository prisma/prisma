import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { Command } from '@prisma/internals'
import { DbPull } from '@prisma/migrate'

import { CLI } from '../../CLI'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

class FakeCommand implements Command {
  public static mockParse = jest.fn()

  public static new(): FakeCommand {
    return new FakeCommand()
  }

  public async parse(_argv: string[]): Promise<string | Error> {
    return await FakeCommand.mockParse()
  }
}

const cliInstance = CLI.new(
  {
    // init: Init.new(),
    // migrate: MigrateCommand.new({
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
    // validate: Validate.new(),
    // format: Format.new(),
    // telemetry: Telemetry.new(),
    fake_command: FakeCommand.new(),
  },
  ['version', 'init', 'migrate', 'db', 'introspect', 'dev', 'studio', 'generate', 'validate', 'format', 'telemetry'],
)

it('no params should return help', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse([])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('wrong flag', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse(['--something'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('help flag', async () => {
  const spy = jest.spyOn(cliInstance, 'help').mockImplementation(() => 'Help Me')

  await cliInstance.parse(['--help'])
  expect(spy).toHaveBeenCalledTimes(1)
  spy.mockRestore()
})

it('unknown command', async () => {
  await expect(cliInstance.parse(['doesnotexist'])).resolves.toThrow()
})

it('introspect should include deprecation warning', async () => {
  const result = cliInstance.parse(['introspect'])

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

describe('quiet flag', () => {
  it('ignores command output if it succeeds', async () => {
    FakeCommand.mockParse.mockResolvedValue('fake_command result')

    await cliInstance.parse(['--quiet', 'fake_command'])

    expect(ctx.mocked['console.log'].mock.calls).toHaveLength(0)
  })

  it('still logs errors if the command throws', async () => {
    FakeCommand.mockParse.mockRejectedValue('error in fake_command')

    const result = cliInstance.parse(['--quiet', 'fake_command'])

    await expect(result).rejects.toMatchInlineSnapshot(`"error in fake_command"`)
  })

  describe('fails for commands that require an output', () => {
    it('init', async () => {
      await expect(ctx.cli('--quiet', 'init').catch((e) => e)).resolves.toMatchObject({
        exitCode: 1,
        stderr: 'Error: The init command does not support --quiet',
      })
    })

    it('studio', async () => {
      await expect(ctx.cli('--quiet', 'studio').catch((e) => e)).resolves.toMatchObject({
        exitCode: 1,
        stderr: 'Error: The studio command does not support --quiet',
      })
    })

    it('validate', async () => {
      await expect(ctx.cli('--quiet', 'validate').catch((e) => e)).resolves.toMatchObject({
        exitCode: 1,
        stderr: 'Error: The validate command does not support --quiet',
      })
    })

    it('version', async () => {
      await expect(ctx.cli('--quiet', 'version').catch((e) => e)).resolves.toMatchObject({
        exitCode: 1,
        stderr: 'Error: The version command does not support --quiet',
      })
    })

    it('debug', async () => {
      await expect(ctx.cli('--quiet', 'debug').catch((e) => e)).resolves.toMatchObject({
        exitCode: 1,
        stderr: 'Error: The debug command does not support --quiet',
      })
    })
  })

  describe('prints nothing in real commands', () => {
    it('generate', async () => {
      ctx.fixture('example-project')

      const data = await ctx.cli('--quiet', 'generate')

      expect(data.stdout).toMatchInlineSnapshot('"Prisma schema loaded from prisma/schema.prisma"')
    })

    it('migrate dev', async () => {
      ctx.fixture('schema-only')

      const data = await ctx.cli('--quiet', 'migrate', 'dev', '-n', 'test_migration')

      expect(data.stdout).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "db": SQLite database "dev.db" at "file:dev.db"

        SQLite database dev.db created at file:dev.db

        Applying migration \`20201231000000_test_migration\`

        The following migration(s) have been created and applied from new schema changes:

        migrations/
          └─ 20201231000000_test_migration/
            └─ migration.sql

        Your database is now in sync with your schema.

        Running generate... (Use --skip-generate to skip the generators)
        Running generate... - Prisma Client
        ✔ Generated Prisma Client (v0.0.0) to ./../../../../../../../Users/paulo/src/git
        hub.com/prisma_cli_silent_flag/packages/client in XXXms
        "
      `)
    })

    it('db pull', async () => {
      ctx.fixture('example-project')

      const data = await ctx.cli('--quiet', 'db', 'pull')

      expect(data.stdout).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "db": SQLite database "dev.db" at "file:dev.db"

        - Introspecting based on datasource defined in prisma/schema.prisma
        ✔ Introspected 3 models and wrote them into prisma/schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client."
      `)
    })

    it('db push', async () => {
      ctx.fixture('schema-only')

      const data = await ctx.cli('--quiet', 'db', 'push')

      expect(data.stdout).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "db": SQLite database "dev.db" at "file:dev.db"

        SQLite database dev.db created at file:dev.db

        🚀  Your database is now in sync with your Prisma schema. Done in XXXms

        Running generate... (Use --skip-generate to skip the generators)
        Running generate... - Prisma Client
        ✔ Generated Prisma Client (v0.0.0) to ./../../../../../../../Users/paulo/src/git
        hub.com/prisma_cli_silent_flag/packages/client in XXXms"
      `)
    })

    it('format', async () => {
      ctx.fixture('schema-only')

      const data = await ctx.cli('--quiet', 'format')

      expect(data.stdout).toMatchInlineSnapshot('"Prisma schema loaded from prisma/schema.prisma"')
    })
  })
})
