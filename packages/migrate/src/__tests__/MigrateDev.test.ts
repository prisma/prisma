// describeIf is making eslint unhappy about the test names
/* eslint-disable jest/no-identical-title */

import { jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs-jetpack'
import path from 'path'
import prompt from 'prompts'

import { MigrateDev } from '../commands/MigrateDev'
import { setupCockroach, tearDownCockroach } from '../utils/setupCockroach'
import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'
import { DbExecute } from '../commands/DbExecute'

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)
const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// Disable prompts
process.env.GITHUB_ACTIONS = '1'
// Disable generate
process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

function removeSeedlingEmoji(str: string) {
  return str.replace('🌱  ', '')
}

describe('common', () => {
  it('invalid schema', async () => {
    ctx.fixture('schema-only-sqlite')

    try {
      await MigrateDev.new().parse(['--schema=./prisma/invalid.prisma'])
      expect(true).toBe(false) // unreachable
    } catch (error) {
      expect(error.message).toMatchInlineSnapshot(`
        Prisma schema validation - (get-config wasm)
        Error code: P1012
        error: Error validating: This line is invalid. It does not start with any known Prisma schema keyword.
          -->  schema.prisma:10
           | 
         9 | }
        10 | model Blog {
        11 | 
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from prisma/invalid.prisma`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('provider array should fail', async () => {
    ctx.fixture('schema-only-sqlite')

    try {
      await MigrateDev.new().parse(['--schema=./prisma/provider-array.prisma'])
      expect(true).toBe(false) // unreachable
    } catch (error) {
      expect(error.message).toMatchInlineSnapshot(`
        Prisma schema validation - (get-config wasm)
        Error code: P1012
        error: Error validating datasource \`my_db\`: The provider argument in a datasource must be a string literal
          -->  schema.prisma:2
           | 
         1 | datasource my_db {
         2 |     provider = ["postgresql", "sqlite"]
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0
      `)
    }
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from prisma/provider-array.prisma`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('wrong flag', async () => {
    const commandInstance = MigrateDev.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--something'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('help flag', async () => {
    const commandInstance = MigrateDev.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--help'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if old migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateDev.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

            Read more about how to upgrade to the new version of Migrate:
            https://pris.ly/d/migrate-upgrade
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now Generally Available.
            WARNING this new version has some breaking changes to use it it's recommended to read the documentation first and remove the --experimental flag.
          `)
  })
  it('should fail if early access flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was in Early Access and is now Generally Available.
            Remove the --early-access-feature flag.
          `)
  })
  it('dev should error in unattended environment', async () => {
    ctx.fixture('transition-db-push-migrate')
    const result = MigrateDev.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Prisma Migrate has detected that the environment is non-interactive, which is not supported.

            \`prisma migrate dev\` is an interactive command designed to create new migrations and evolve the database in development.
            To apply existing migrations in deployments, use prisma migrate deploy.
            See https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-deploy
          `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('sqlite', () => {
  it('empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDev.new().parse(['--schema=./prisma/empty.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Already in sync, no schema change or pending migration was found.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('first migration (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(fs.exists('prisma/migrations/migration_lock.toml')).toEqual('file')

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  //
  // TODO: Windows: test fails with:
  //
  // [Error: Failed to create a new migration directory.
  //    0: migration_core::api::CreateMigration
  //            with migration_name="xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end" draft=false
  //              at migration-engine\core\src\api.rs:94
  // ]
  //
  // Probably the file name is too long for Windows?
  //
  testIf(process.platform !== 'win32')('first migration (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject([
      'xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end_this_should_be_truncated',
    ])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Enter a name for the new migration:
      Applying migration \`20201231000000_xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  // it('first migration --name --force', async () => {
  //   ctx.fixture('schema-only-sqlite')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //
  //   ])

  //   await expect(result).resolves.toMatchInlineSnapshot(
  //     `Everything is now in sync.`,
  //   )
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma

  //     SQLite database dev.db created at file:dev.db

  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //   `)
  //   expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
  //   expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  // })

  it('snapshot of sql', async () => {
    ctx.fixture('schema-only-sqlite')

    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)

    const baseDir = path.join('prisma', 'migrations')
    const migrationDirList = fs.list(baseDir)
    const migrationFilePath = path.join(baseDir, migrationDirList![0], 'migration.sql')
    const migrationFile = fs.read(migrationFilePath)
    expect(migrationFile).toMatchInlineSnapshot(`
      -- CreateTable
      CREATE TABLE "Blog" (
          "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
          "viewCount20" INTEGER NOT NULL
      );

    `)
  })

  it('draft migration and apply (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject(['some-Draft'])

    const draftResult = MigrateDev.new().parse(['--create-only'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_some_draft

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])

    await expect(applyResult).resolves.toMatchInlineSnapshot(``)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Enter a name for the new migration:
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Applying migration \`20201231000000_some_draft\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_some_draft/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('draft migration with empty schema (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject(['some-empty-Draft'])

    const draftResult = MigrateDev.new().parse(['--schema=./prisma/empty.prisma', '--create-only'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_some_empty_draft

            You can now edit it and apply it by running prisma migrate dev.
          `)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Enter a name for the new migration:
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const draftResult = MigrateDev.new().parse(['--create-only', '--name=first'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])

    await expect(applyResult).resolves.toMatchInlineSnapshot(``)
    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('transition-db-push-migrate (prompt reset yes)', async () => {
    ctx.fixture('transition-db-push-migrate')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Drift detected: Your database schema is not in sync with your migration history.

      The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

      It should be understood as the set of changes to get from the expected schema to the actual schema.

      If you are running this the first time on an existing database, please make sure to read this documentation page:
      https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development

      [+] Added tables
        - Blog
        - _Migration

      We need to reset the SQLite database "dev.db" at "file:dev.db"
      Do you want to continue? All data will be lost.

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('transition-db-push-migrate (prompt reset no)', async () => {
    ctx.fixture('transition-db-push-migrate')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()])

    const result = MigrateDev.new().parse([])

    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 130`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Drift detected: Your database schema is not in sync with your migration history.

      The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

      It should be understood as the set of changes to get from the expected schema to the actual schema.

      If you are running this the first time on an existing database, please make sure to read this documentation page:
      https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development

      [+] Added tables
        - Blog
        - _Migration

      We need to reset the SQLite database "dev.db" at "file:dev.db"
      Do you want to continue? All data will be lost.

      Reset cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(mockExit).toHaveBeenCalledWith(130)
  })

  it('edited migration and unapplied empty draft', async () => {
    ctx.fixture('edited-and-draft')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The migration \`20201231000000_test\` was modified after it was applied.
      We need to reset the SQLite database "dev.db" at "file:dev.db"
      Do you want to continue? All data will be lost.

      Applying migration \`20201231000000_test\`
      Applying migration \`20201231000000_draft\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_test/
          └─ migration.sql
        └─ 20201231000000_draft/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('removed applied migration and unapplied empty draft', async () => {
    ctx.fixture('edited-and-draft')
    fs.remove('prisma/migrations/20201117144659_test')

    prompt.inject(['y', 'new-change'])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      - Drift detected: Your database schema is not in sync with your migration history.

      The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

      It should be understood as the set of changes to get from the expected schema to the actual schema.

      [+] Added tables
        - Blog

      - The migrations recorded in the database diverge from the local migrations directory.

      We need to reset the SQLite database "dev.db" at "file:dev.db"
      Do you want to continue? All data will be lost.

      Applying migration \`20201231000000_draft\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql
      Enter a name for the new migration:
      Applying migration \`20201231000000_new_change\`


      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_new_change/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('broken migration should fail', async () => {
    ctx.fixture('broken-migration')

    try {
      await MigrateDev.new().parse([])
    } catch (e) {
      expect(e.code).toEqual('P3006')
      expect(e.message).toContain('near "BROKEN": syntax error')
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('existingdb: has a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')

    try {
      await MigrateDev.new().parse([])
    } catch (e) {
      expect(e.code).toEqual('P3006')
      expect(e.message).toContain('P3006')
      expect(e.message).toContain('failed to apply cleanly to the shadow database.')
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('existing-db-1-migration edit migration with broken sql', async () => {
    ctx.fixture('existing-db-1-migration')

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    // Edit with broken SQL
    fs.write('prisma/migrations/20201014154943_init/migration.sql', 'CREATE BROKEN')

    try {
      await MigrateDev.new().parse([])
    } catch (e) {
      expect(e.code).toEqual('P3006')
      expect(e.message).toContain('P3006')
      expect(e.message).toContain('failed to apply cleanly to the shadow database.')
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Already in sync, no schema change or pending migration was found.
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: 1 unapplied draft', async () => {
    ctx.fixture('existing-db-1-draft')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Applying migration \`20201231000000_draft\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: 1 unapplied draft + 1 schema change', async () => {
    ctx.fixture('existing-db-1-draft-1-change')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Applying migration \`20201231000000_draft\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql
      Applying migration \`20201231000000_\`


      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: 1 unexecutable schema change', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = MigrateDev.new().parse([])

    await expect(result).rejects.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              ⚠️ We found changes that cannot be executed:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                • Step 0 Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              You can use prisma migrate dev --create-only to create the migration file, and manually modify it to address the underlying issue(s).
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              Then run prisma migrate dev to apply it and verify it works.

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: 1 unexecutable schema change with --create-only should succeed', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = MigrateDev.new().parse(['--create-only'])

    await expect(result).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_

            You can now edit it and apply it by running prisma migrate dev.
          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 warning from schema change (prompt yes)', async () => {
    ctx.fixture('existing-db-1-warning')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                              ⚠️  Warnings for the current datasource:

                                                                                                                                                                                                                                                                                                                                                                                • You are about to drop the \`Blog\` table, which is not empty (2 rows).
                                                                                                                                                                                                                                                    `)
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: 1 warning from schema change (prompt no)', async () => {
    ctx.fixture('existing-db-1-warning')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject([new Error()])

    const result = MigrateDev.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 130`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Migration cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                              ⚠️  Warnings for the current datasource:

                                                                                                                                                                                                                                                                                                                                                                                • You are about to drop the \`Blog\` table, which is not empty (2 rows).
                                                                                                                                                                                                                                                    `)
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(mockExit).toHaveBeenCalledWith(130)
  })

  test('one seed.ts file', async () => {
    ctx.fixture('seed-sqlite-ts')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(removeSeedlingEmoji(ctx.mocked['console.info'].mock.calls.join('\n'))).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db

      Enter a name for the new migration:
      Applying migration \`20201231000000_y\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_y/
          └─ migration.sql

      Your database is now in sync with your schema.

      Running seed command \`ts-node prisma/seed.ts\` ...

      The seed command has been executed.

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('one seed file --skip-seed', async () => {
    ctx.fixture('seed-sqlite-ts')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--skip-seed'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db

      Enter a name for the new migration:
      Applying migration \`20201231000000_y\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_y/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })

  it('one broken seed.js file', async () => {
    ctx.fixture('seed-sqlite-js')
    fs.write('prisma/seed.js', 'BROKEN_CODE_SHOULD_ERROR;')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    prompt.inject(['y'])

    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db

      Enter a name for the new migration:
      Applying migration \`20201231000000_y\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_y/
          └─ migration.sql

      Your database is now in sync with your schema.

      Running seed command \`node prisma/seed.js\` ...
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join()).toContain(`An error occurred while running the seed command:`)
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('legacy seed (no config in package.json)', async () => {
    ctx.fixture('seed-sqlite-legacy')
    ctx.fs.remove('prisma/seed.js')
    // ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')
    prompt.inject(['y']) // simulate user yes input

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db

      Enter a name for the new migration:
      Applying migration \`20201231000000_y\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_y/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('provider switch: postgresql to sqlite', async () => {
    ctx.fixture('provider-switch-postgresql-to-sqlite')

    try {
      await MigrateDev.new().parse([])
    } catch (e) {
      expect(e.code).toEqual('P3019')
      expect(e.message).toContain('P3019')
      expect(e.message).toContain('The datasource provider')
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      SQLite database dev.db created at file:./dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })
})

describe('postgresql', () => {
  const connectionString = (
    process.env.TEST_POSTGRES_URI_MIGRATE || 'postgres://prisma:prisma@localhost:5432/tests-migrate'
  ).replace('tests-migrate', 'tests-migrate-dev')

  // Update env var because it's the one that is used in the schemas tested
  process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  process.env.TEST_POSTGRES_SHADOWDB_URI_MIGRATE = connectionString.replace(
    'tests-migrate-dev',
    'tests-migrate-dev-shadowdb',
  )

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

  beforeEach(async () => {
    await setupPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateDev.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('create first migration with nativeTypes', async () => {
    ctx.fixture('nativeTypes-postgresql')

    const result = MigrateDev.new().parse(['--name=first'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // it('first migration --force + --name', async () => {
  //   ctx.fixture('schema-only-postgresql')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //   ])

  //   await expect(result).resolves.toMatchInlineSnapshot(
  //     `Everything is now in sync.`,
  //   )
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma
  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //   `)
  //   expect(ctx.mocked['console.log'].mock.calls).toEqual([])
  //   expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  // })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-postgresql')
    jest.setTimeout(7_000)

    const draftResult = MigrateDev.new().parse(['--create-only', '--name=first'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])
    await expect(applyResult).resolves.toMatchInlineSnapshot(``)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: create first migration', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schema "public" at "localhost:5432"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  // it('real-world-grading-app: compare snapshot', async () => {
  //   ctx.fixture('real-world-grading-app')
  //   const result = MigrateDev.new().parse([])

  //   await expect(result).resolves.toMatchInlineSnapshot()
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma Schema loaded from prisma/schema.prisma

  //     Prisma Migrate applied the following migration(s):

  //     migrations/
  //       └─ 20201231000000_/
  //         └─ migration.sql
  //   `)

  //   expect(ctx.mocked['console.log'].mock.calls).toEqual([])
  //   expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  //   expect(
  //     fs.read(`prisma/${fs.list('prisma/migrations')![0]}/migration.sql`),
  //   ).toEqual([])
  // })

  // TODO in follow-up PR make it passing reliably in CI
  // Failed with
  // Snapshot: db error: ERROR: relation "_prisma_migrations" already exists
  // 0: migration_core::state::ApplyMigrations
  // at migration-engine/core/src/state.rs:199
  // Probably needs to run on an isolated db (currently in a git stash)
  it.skip('need to reset prompt: (no) should succeed', async () => {
    ctx.fixture('schema-only-postgresql')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    await fs.writeAsync(
      'script.sql',
      `CREATE TABLE "public"."User" (
        "id" text,
        "email" text NOT NULL,
        "name" text,
        PRIMARY KEY ("id")
    );`,
    )

    const dbExecuteResult = DbExecute.new().parse(['--schema=./prisma/schema.prisma', '--file=./script.sql'])
    await expect(dbExecuteResult).resolves.toMatchInlineSnapshot(`Script executed successfully.`)

    prompt.inject(['test', new Error()]) // simulate user cancellation
    // prompt.inject(['y']) // simulate user cancellation

    const result = MigrateDev.new().parse(['--schema=prisma/multiSchema.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      db error: ERROR: relation "_prisma_migrations" already exists
         0: migration_core::state::ApplyMigrations
                   at migration-engine/core/src/state.rs:199

    `)
    expect(mockExit).toHaveBeenCalledWith(130)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/multiSchema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-dev", schemas "schema1, schema2" at "localhost:5432"

      Enter a name for the new migration:
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchInlineSnapshot(`Canceled by user.`)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })
})

describeIf(!process.env.TEST_SKIP_COCKROACHDB)('cockroachdb', () => {
  const connectionString = (
    process.env.TEST_COCKROACH_URI_MIGRATE || 'postgresql://prisma@localhost:26257/tests-migrate'
  ).replace('tests-migrate', 'tests-migrate-dev')

  // Update env var because it's the one that is used in the schemas tested
  process.env.TEST_COCKROACH_URI_MIGRATE = connectionString
  process.env.TEST_COCKROACH_SHADOWDB_URI_MIGRATE = connectionString.replace(
    'tests-migrate-dev',
    'tests-migrate-dev-shadowdb',
  )

  const setupParams = {
    connectionString,
    dirname: '',
  }

  beforeEach(async () => {
    await setupCockroach(setupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownCockroach(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-cockroachdb')

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-cockroachdb')

    const result = MigrateDev.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev-shadowdb", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-cockroachdb')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('create first migration with nativeTypes', async () => {
    ctx.fixture('nativeTypes-cockroachdb')

    const result = MigrateDev.new().parse(['--name=first'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  }, 40000)

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-cockroachdb')
    jest.setTimeout(7_000)

    const draftResult = MigrateDev.new().parse(['--create-only', '--name=first'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])
    await expect(applyResult).resolves.toMatchInlineSnapshot(``)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: create first migration', async () => {
    ctx.fixture('schema-only-cockroachdb')
    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": CockroachDB database "tests-migrate-dev", schema "public" at "localhost:26257"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })
})

describe('mysql', () => {
  const connectionString = (
    process.env.TEST_MYSQL_URI_MIGRATE || 'mysql://root:root@localhost:3306/tests-migrate'
  ).replace('tests-migrate', 'tests-migrate-dev')

  // Update env var because it's the one that is used in the schemas tested
  process.env.TEST_MYSQL_URI_MIGRATE = connectionString
  process.env.TEST_MYSQL_SHADOWDB_URI_MIGRATE = connectionString.replace(
    'tests-migrate-dev',
    'tests-migrate-dev-shadowdb',
  )

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

  beforeEach(async () => {
    await setupMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-mysql')

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-mysql')

    const result = MigrateDev.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-mysql')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  // it('create first migration with nativeTypes', async () => {
  //   ctx.fixture('nativeTypes-mysql')

  //   const result = MigrateDev.new().parse(['--name=first'])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)

  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma
  //     Datasource "db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //     Your database is now in sync with your schema.
  //   `)
  //   expect(
  //     ctx.mocked['console.error'].mock.calls.join('\n'),
  //   ).toMatchInlineSnapshot(``)
  // })

  // it('first migration --force + --name', async () => {
  //   ctx.fixture('schema-only-mysql')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //   ])

  //   await expect(result).resolves.toMatchInlineSnapshot(
  //     `Everything is now in sync.`,
  //   )
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma
  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //   `)
  //   expect(ctx.mocked['console.log'].mock.calls).toEqual([])
  //   expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  // })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-mysql')
    jest.setTimeout(7_000)

    const draftResult = MigrateDev.new().parse(['--create-only', '--name=first'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])
    await expect(applyResult).resolves.toMatchInlineSnapshot(``)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: create first migration', async () => {
    ctx.fixture('schema-only-mysql')
    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-dev" at "localhost:3306"

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })
})

describeIf(!process.env.TEST_SKIP_MSSQL)('SQL Server', () => {
  if (process.env.CI) {
    // to avoid timeouts on macOS
    jest.setTimeout(80_000)
  } else {
    jest.setTimeout(20_000)
  }

  const connectionString = process.env.TEST_MSSQL_URI || 'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master'

  // Update env var because it's the one that is used in the schemas tested
  process.env.TEST_MSSQL_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_JDBC_URI_MIGRATE?.replace(
    'tests-migrate',
    'tests-migrate-dev',
  )
  process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE = process.env.TEST_MSSQL_SHADOWDB_JDBC_URI_MIGRATE?.replace(
    'tests-migrate-shadowdb',
    'tests-migrate-dev-shadowdb',
  )

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

  beforeAll(async () => {
    await tearDownMSSQL(setupParams, 'tests-migrate-dev').catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMSSQL(setupParams, 'tests-migrate-dev').catch((e) => {
      console.error(e)
    })
  })

  afterEach(async () => {
    await tearDownMSSQL(setupParams, 'tests-migrate-dev').catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-sqlserver')

    const result = MigrateDev.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQL Server database

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-sqlserver')

    const result = MigrateDev.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "my_db": SQL Server database

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-sqlserver')
    const result = MigrateDev.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQL Server database

      Applying migration \`20201231000000_\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  // it('create first migration with nativeTypes', async () => {
  //   ctx.fixture('nativeTypes-sqlserver')

  //   const result = MigrateDev.new().parse(['--name=first'])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)

  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma
  //     Datasource "db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //     Your database is now in sync with your schema.
  //   `)
  //   expect(
  //     ctx.mocked['console.error'].mock.calls.join('\n'),
  //   ).toMatchInlineSnapshot(``)
  // })

  // it('first migration --force + --name', async () => {
  //   ctx.fixture('schema-only-sqlserver')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //   ])

  //   await expect(result).resolves.toMatchInlineSnapshot(
  //     `Everything is now in sync.`,
  //   )
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma schema loaded from prisma/schema.prisma
  //     The following migration(s) have been created and applied from new schema changes:

  //     migrations/
  //       └─ 20201231000000_first/
  //         └─ migration.sql

  //   `)
  //   expect(ctx.mocked['console.log'].mock.calls).toEqual([])
  //   expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  // })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-sqlserver')

    const draftResult = MigrateDev.new().parse(['--create-only', '--name=first'])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev.
          `)

    const applyResult = MigrateDev.new().parse([])
    await expect(applyResult).resolves.toMatchInlineSnapshot(``)

    expect((fs.list('prisma/migrations')?.length || 0) > 0).toMatchInlineSnapshot(`true`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQL Server database

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQL Server database

      Applying migration \`20201231000000_first\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })

  it('existingdb: create first migration', async () => {
    ctx.fixture('schema-only-sqlserver')
    const result = MigrateDev.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQL Server database

      Applying migration \`20201231000000_first\`

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })
})
