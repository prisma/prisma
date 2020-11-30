import fs from 'fs-jetpack'
import path from 'path'
import { MigrateStatus } from '../commands/MigrateStatus'
import { consoleContext, Context } from './__helpers__/context'
import { tearDownMysql } from '../utils/setupMysql'
import {
  SetupParams,
  setupPostgres,
  tearDownPostgres,
} from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

process.env.GITHUB_ACTIONS = '1'

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --early-access-feature flag to use this command.
          `)
  })
})

describe('sqlite', () => {
  it('should fail if no sqlite db - empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateStatus.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/empty.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-failed-migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')

    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            The failed migration(s) can be marked as rolled back or applied:
                  
            - If you rolled back the migration(s) manually:
            prisma migrate resolve --rolledback "20201231000000_failed" --early-access-feature

            - If you fixed the database manually (hotfix):
            prisma migrate resolve --applied "20201231000000_failed" --early-access-feature
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - 1 migration
      - 1 failed migration: 20201231000000_failed

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('baseline-sqlite', async () => {
    ctx.fixture('baseline-sqlite')

    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            The current database is not managed by Prisma Migrate.

            If you want to keep the current database structure and data and create new migrations, baseline this database with the migration "20201231000000_":
            prisma migrate resolve --applied "20201231000000_" --early-access-feature
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - 1 migration
      - 1 unapplied migration: 20201231000000_
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`No problem detected.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - 1 migration

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-migration-conflict', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            The current database is not managed by Prisma Migrate.

            If you want to keep the current database structure and data and create new migrations, baseline this database with the migration "20201231000000_init":
            prisma migrate resolve --applied "20201231000000_init" --early-access-feature
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - 1 migration
      - 1 unapplied migration: 20201231000000_init
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-brownfield', async () => {
    ctx.fixture('existing-db-brownfield')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Check init flow with introspect + SQL schema dump (TODO docs)`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - No migration found
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-warnings', async () => {
    ctx.fixture('existing-db-warnings')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Check init flow with introspect + SQL schema dump (TODO docs)`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - No migration found
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('old-migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            The migrations folder contains migrations files from an older version of Prisma Migrate which is not compatible.
            Delete the current migrations folder to continue and read the documentation for how to upgrade / baseline.
          `)

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('initialized-sqlite', async () => {
    ctx.fixture('initialized-sqlite')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('reset', async () => {
    ctx.fixture('reset')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`No problem detected.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Status
      - 1 migration

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})
