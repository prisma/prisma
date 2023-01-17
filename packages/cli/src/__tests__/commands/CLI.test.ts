import { handlePanic, jestConsoleContext, jestContext } from '@prisma/internals'
import {
  DbCommand,
  DbPull,
  DbPush,
  // DbDrop,
  DbSeed,
  MigrateCommand,
  MigrateDeploy,
  MigrateDev,
  MigrateReset,
  MigrateResolve,
  MigrateStatus,
} from '@prisma/migrate'

import { CLI } from '../../CLI'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

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
    // doctor: Doctor.new(),
    // telemetry: Telemetry.new(),
  },
  [
    'version',
    'init',
    'migrate',
    'db',
    'introspect',
    'dev',
    'studio',
    'generate',
    'validate',
    'format',
    'doctor',
    'telemetry',
  ],
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
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
  expect(ctx.mocked['console.log'].mock.calls).toHaveLength(0)
  expect(ctx.mocked['console.info'].mock.calls).toHaveLength(0)
  expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
    prisma:warn 
    prisma:warn The prisma introspect command is deprecated. Please use prisma db pull instead.
    prisma:warn 
  `)
  expect(ctx.mocked['console.error'].mock.calls).toHaveLength(0)
})
