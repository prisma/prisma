import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import prompt from 'prompts'

import { MigrateReset } from '../commands/MigrateReset'
import { executeSeedCommand, getSeedCommandFromPackageJson } from '../utils/seed'

process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

jest.mock('../utils/seed')

function removeSeedlingEmoji(str: string) {
  return str.replace('🌱  ', '')
}

describe('Enable seed args in reset', () => {
  const mockedExecuteSeedCommand = jest.mocked(executeSeedCommand)
  const mockedGetSeedCommandFromPackageJson = jest.mocked(getSeedCommandFromPackageJson)

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('Should execute the `executeSeedCommand` with extraArgs as undefined when no seed args provided', async () => {
    // Given
    ctx.fixture('reset')
    prompt.inject(['y']) // simulate user yes input
    mockedGetSeedCommandFromPackageJson.mockResolvedValue('seedCommandToExecute')
    mockedExecuteSeedCommand.mockResolvedValue(true)

    const result = MigrateReset.new().parse(['--allow-seed-args'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.pop()[0].includes('The seed command has been executed.'),
    ).toStrictEqual(true)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockedExecuteSeedCommand).toHaveBeenCalledWith({
      commandFromConfig: 'seedCommandToExecute',
      extraArgs: undefined,
    })
    expect(mockedGetSeedCommandFromPackageJson).toHaveBeenCalled()
  })

  it('Should execute the `executeSeedCommand` with extraArgs as when provided', async () => {
    // Given
    ctx.fixture('reset')
    prompt.inject(['y']) // simulate user yes input
    mockedGetSeedCommandFromPackageJson.mockResolvedValue('seedCommandToExecute')
    mockedExecuteSeedCommand.mockResolvedValue(true)

    const result = MigrateReset.new().parse(['--allow-seed-args', '--environment', 'development'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.pop()[0].includes('The seed command has been executed.'),
    ).toStrictEqual(true)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockedExecuteSeedCommand).toHaveBeenCalledWith({
      commandFromConfig: 'seedCommandToExecute',
      extraArgs: '--environment development',
    })
    expect(mockedGetSeedCommandFromPackageJson).toHaveBeenCalled()
  })

  it('Should execute the `executeSeedCommand` with extraArgs and prevent the system defined args to reach executeSeed', async () => {
    // Given
    ctx.fixture('reset')
    prompt.inject(['y']) // simulate user yes input
    mockedGetSeedCommandFromPackageJson.mockResolvedValue('seedCommandToExecute')
    mockedExecuteSeedCommand.mockResolvedValue(true)

    const result = MigrateReset.new().parse(['--allow-seed-args', '--environment', 'development', '--skip-generate'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.pop()[0].includes('The seed command has been executed.'),
    ).toStrictEqual(true)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockedExecuteSeedCommand).toHaveBeenCalledWith({
      commandFromConfig: 'seedCommandToExecute',
      extraArgs: '--environment development',
    })
    expect(mockedGetSeedCommandFromPackageJson).toHaveBeenCalled()
  })
})

describe('common', () => {
  it('wrong flag', async () => {
    const commandInstance = MigrateReset.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--something'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('help flag', async () => {
    const commandInstance = MigrateReset.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--help'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateReset.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
})

describe('reset', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should work (prompt)', async () => {
    ctx.fixture('reset')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Applying migration \`20201231000000_init\`

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should work (--force)', async () => {
    ctx.fixture('reset')

    const result = MigrateReset.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Applying migration \`20201231000000_init\`

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('with missing db', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = MigrateReset.new().parse(['--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Applying migration \`20201231000000_init\`

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('without the migrations directory should fail (prompt)', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/migrations')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Database reset successful

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should be cancelled if user send n (prompt)', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()]) // simulate user cancellation

    const result = MigrateReset.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 130`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Reset cancelled.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('reset - multiple seed files', async () => {
    ctx.fixture('seed-sqlite-legacy')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db


      Database reset successful

    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('reset - multiple seed files - --skip-seed', async () => {
    ctx.fixture('seed-sqlite-legacy')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse(['--skip-seed'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('reset - seed.js', async () => {
    ctx.fixture('seed-sqlite-js')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(removeSeedlingEmoji(ctx.mocked['console.info'].mock.calls.join('\n'))).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db


      Database reset successful

    `)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  test('reset - seed.ts', async () => {
    ctx.fixture('seed-sqlite-ts')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(removeSeedlingEmoji(ctx.mocked['console.info'].mock.calls.join('\n'))).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db


      Database reset successful

    `)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  }, 10_000)

  it('reset - legacy seed (no config in package.json)', async () => {
    ctx.fixture('seed-sqlite-legacy')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    // ctx.fs.remove('prisma/seed.sh')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db


      Database reset successful

    `)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should work with directUrl', async () => {
    ctx.fixture('reset-directurl')

    prompt.inject(['y']) // simulate user yes input

    const result = MigrateReset.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Applying migration \`20201231000000_init\`

      Database reset successful

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_init/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})
