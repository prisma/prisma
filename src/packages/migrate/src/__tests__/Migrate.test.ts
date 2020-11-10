process.env.MIGRATE_SKIP_GENERATE = '1'

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

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

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

            Commands

                  up      Migrate your database up
                  reset   Reset your database, all data will be lost

            Examples

              Create a new migration and apply it
              $ prisma migrate --early-access-feature

              Reset your database
              $ prisma migrate reset --early-access-feature

          `)
  })
})

describe('sqlite', () => {
  it('first migration after init - empty schema', async () => {
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

  it.skip('first migration after init', async () => {
    ctx.fixture('schema-only-sqlite')

    setTimeout(() => stdin.send(`my migration name\r`), 500)

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it.skip('first migration after init', async () => {
    ctx.fixture('schema-only-sqlite')

    setTimeout(() => stdin.send(`my MigrationName\r`), 100)

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot(``)
  })

  it.skip('create draft migration and apply', async () => {
    ctx.fixture('schema-only-sqlite')

    setTimeout(() => stdin.send(`my Migration$$*(Name\r`), 100)

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
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })
})

describe.skip('postgresql', () => {
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

  it('schema only', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateCommand.new().parse(['--early-access-feature'])
    await expect(result).resolves.toThrowErrorMatchingInlineSnapshot(
      `Use the --force flag to use the reset command in an unnattended environment like prisma reset --force --early-access-feature`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
  })

  it.skip('first migration after init - empty schema', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateCommand.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])

    await expect(result).resolves.toMatchSnapshot()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/empty.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it.skip('first migration after init', async () => {
    ctx.fixture('schema-only-postgresql')

    setTimeout(() => stdin.send(`myMigrationName\r`), 1500)

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it.skip('first migration after init --force', async () => {
    ctx.fixture('schema-only-postgresql')

    setTimeout(() => stdin.send(`myMigrationName\r`), 1500)

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it.skip('create draft migration and apply', async () => {
    ctx.fixture('schema-only-postgresql')

    setTimeout(() => stdin.send(`myDraftMigrationName\r`), 1500)

    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--early-access-feature',
    ])

    await expect(draftResult).resolves.toMatchSnapshot()

    const applyResult = MigrateCommand.new().parse(['--early-access-feature'])
    await expect(applyResult).resolves.toMatchSnapshot()

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma
      Prisma Schema loaded from prisma/schema.prisma
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it.skip('existingdb: first migration after init', async () => {
    ctx.fixture('schema-only-postgresql')

    setTimeout(() => stdin.send(`myDraftMigrationName\r`), 1500)

    const result = MigrateCommand.new().parse(['--early-access-feature'])

    await expect(result).resolves.toMatchSnapshot()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
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
