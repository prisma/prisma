process.env.GITHUB_ACTIONS = '1'

import fs from 'fs-jetpack'
import { MigrateDeploy } from '../commands/MigrateDeploy'
import { consoleContext, Context } from './__helpers__/context'
import { tearDownMysql } from '../utils/setupMysql'
import {
  SetupParams,
  setupPostgres,
  tearDownPostgres,
} from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --early-access-feature flag to use this command.
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDeploy.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now in Early Access.
                  WARNING this new iteration has some breaking changes to use it it's recommended to read the documentation first and replace the --experimental flag with --early-access-feature.
          `)
  })
})

describe('sqlite', () => {
  it('no unapplied migrations', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDeploy.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(
      `No pending migrations to apply.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma

      SQLite database dev.db created at file:dev.db


      No migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('1 unapplied migration', async () => {
    ctx.fixture('existing-db-1-migration')
    fs.remove('prisma/dev.db')

    const result = MigrateDeploy.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`
            The following migration have been applied:

            migrations/
              └─ 20201231000000_init/
                └─ migration.sql
                  
                  All migrations have been successfully applied.
          `)

    // Second time should do nothing (already applied)
    const resultBis = MigrateDeploy.new().parse(['--early-access-feature'])
    await expect(resultBis).resolves.toMatchInlineSnapshot(
      `No pending migrations to apply.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db


      1 migration found in prisma/migrations

      Prisma schema loaded from prisma/schema.prisma

      1 migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('should throw if database is not empty', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    const result = MigrateDeploy.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            P3005

            The database schema for \`dev.db\` is not empty. Please follow the to-be-written instructions on how to set up migrate with an existing database, or use an empty database.

          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      1 migration found in prisma/migrations
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})
