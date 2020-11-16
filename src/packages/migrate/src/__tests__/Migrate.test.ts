import prompt from 'prompts'
import fs from 'fs-jetpack'
import { MigrateCommand } from '../commands/MigrateCommand'
import { consoleContext, Context } from './__helpers__/context'
import { tearDownMysql } from '../utils/setupMysql'
import {
  SetupParams,
  setupPostgres,
  tearDownPostgres,
} from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

process.env.GITHUB_ACTIONS = '1'
process.env.MIGRATE_SKIP_GENERATE = '1'

// TODO
// add test for isReset needed https://github.com/prisma/prisma/blob/a6c91fd6816bd33d3c44ce3bc56af06c01ddfdba/src/packages/migrate/src/Migrate.ts#L350

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateCommand.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            ! Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location

            🏋️  Migrate your database with confidence

            WARNING Prisma's migration functionality is currently in an experimental state.
            When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.

            Usage

              With an existing schema.prisma:
              $ prisma migrate [command] [options] --early-access-feature

              Or specify a schema:
              $ prisma migrate [command] [options] --early-access-feature --schema=./schema.prisma

            Options

              -h, --help   Display this help message
                 --draft   Create a draft of a migration that can be edited locally before being applied

            Commands

                  up      Migrate your database up
                  reset   Reset your database, all data will be lost

            Examples

              Create a new migration and apply it
              $ prisma migrate --early-access-feature

              Reset your database
              $ prisma migrate reset --early-access-feature

              Create a draft of a migration
              $ prisma migrate --draft --early-access-feature

          `)
  })
  it('should fail if old migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateCommand.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migrations folder contains migrations files from an older version of Prisma Migrate which is not compatible.
            Delete the current migrations folder to continue and read the documentation for how to upgrade / baseline.
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateCommand.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --early-access-feature flag to use this command.
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateCommand.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now in Early Access.
                  WARNING this new iteration has some breaking changes to use it it's recommended to read the documentation first and replace the --experimental flag with --early-access-feature.
          `)
  })
})

describe('sqlite', () => {
  it('first migration after init - empty.prisma', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateCommand.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])
    await expect(result).resolves.toMatchSnapshot()

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/empty.prisma

      SQLite database dev.db created at file:dev.db


      Everything is already in sync - Prisma Migrate didn't find any schema changes or unapplied migrations.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration after init (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db


      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration after init (--name)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject(['first'])

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db


      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration after init --force', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--force',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db


      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot(``)
  })

  it('draft migration and apply (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject(['some-Draft'])

    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--early-access-feature',
    ])

    await expect(draftResult).resolves.toMatchSnapshot()

    const applyResult = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(applyResult).resolves.toMatchSnapshot()
    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

      Prisma Schema loaded from prisma/schema.prisma

      Everything is already in sync - Prisma Migrate didn't find any schema changes or unapplied migrations.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--name=first',
      '--early-access-feature',
    ])

    await expect(draftResult).resolves.toMatchSnapshot()

    const applyResult = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(applyResult).resolves.toMatchSnapshot()
    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

      Prisma Schema loaded from prisma/schema.prisma

      Everything is already in sync - Prisma Migrate didn't find any schema changes or unapplied migrations.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('transition-db-push-migrate (prompt yes)', async () => {
    ctx.fixture('transition-db-push-migrate')

    prompt.inject(['y'])

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(`Operation successful.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma
      Migration "20201231000000_" created.
      Migration "20201231000000_" marked applied.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot(``)
  })

  it('transition-db-push-migrate (prompt no)', async () => {
    ctx.fixture('transition-db-push-migrate')

    prompt.inject([new Error()])

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).rejects.toMatchInlineSnapshot(
      `Check init flow with introspect + SQL schema dump (TODO docs)`,
    )
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot(``)
  })
})

describe('postgresql', () => {
  const SetupParams: SetupParams = {
    connectionString:
      process.env.TEST_POSTGRES_URI_MIGRATE ||
      'postgres://prisma:prisma@localhost:5432/tests-migrate',
    dirname: './fixtures',
  }

  beforeEach(async () => {
    await setupPostgres(SetupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownPostgres(SetupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only (--force)', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateCommand.new().parse([
      '--early-access-feature',
      '--force',
    ])
    await expect(result).resolves.toThrowErrorMatchingInlineSnapshot(
      `undefined`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
  })

  it('first migration after init - empty.prisma', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateCommand.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/empty.prisma

      Everything is already in sync - Prisma Migrate didn't find any schema changes or unapplied migrations.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration after init', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration after init --force + --name', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--force',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('draft migration and apply', async () => {
    ctx.fixture('schema-only-postgresql')
    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--name=first',
      '--early-access-feature',
    ])

    await expect(draftResult).resolves.toMatchSnapshot()

    const applyResult = MigrateCommand.new().parse(['--early-access-feature'])
    await expect(applyResult).resolves.toMatchSnapshot()

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma
      Prisma Schema loaded from prisma/schema.prisma

      Everything is already in sync - Prisma Migrate didn't find any schema changes or unapplied migrations.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: first migration after init', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      Prisma Migrate applied the following migration(s):

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})

describe.skip('mysql', () => {
  const SetupParams: SetupParams = {
    connectionString: `${
      process.env.TEST_MYSQL_URI || 'mysql://prisma:prisma@localhost:3306/tests'
    }`,
    dirname: __dirname,
  }

  beforeEach(async () => {
    await tearDownMysql(SetupParams).catch((e) => {
      console.error({ e })
    })
  })

  afterAll(async () => {
    await tearDownMysql(SetupParams).catch((e) => {
      console.error({ e })
    })
  })
})
