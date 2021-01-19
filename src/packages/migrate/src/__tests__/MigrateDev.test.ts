import prompt from 'prompts'
import fs from 'fs-jetpack'
import path from 'path'
import { MigrateDev } from '../commands/MigrateDev'
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

describe('common', () => {
  it('wrong flag', async () => {
    const commandInstance = MigrateDev.new()
    const spy = jest
      .spyOn(commandInstance, 'help')
      .mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--something'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('help flag', async () => {
    const commandInstance = MigrateDev.new()
    const spy = jest
      .spyOn(commandInstance, 'help')
      .mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--help'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if old migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

            Read more about how to upgrade to the new version of Migrate:
            https://pris.ly/d/migrate-upgrade
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
            Please provide the --preview-feature flag to use this command.
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now in Preview.
            WARNING this new iteration has some breaking changes to use it it's recommended to read the documentation first and replace the --experimental flag with --preview-feature.
          `)
  })
  it('should fail if early access flag', async () => {
    ctx.fixture('empty')
    const result = MigrateDev.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was in Early Access and is now in Preview.
            Replace the --early-access-feature flag with --preview-feature.
          `)
  })
  it('dev should error in unattended environment', async () => {
    ctx.fixture('transition-db-push-migrate')
    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `We detected that your environment is non-interactive. Running this command in not supported in this context.`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})

describe('sqlite', () => {
  it('empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDev.new().parse([
      '--schema=./prisma/empty.prisma',
      '--preview-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Already in sync, no schema change or pending migration was found.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDev.new().parse(['--name=first', '--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('first migration (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject([
      'xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end_this_should_be_truncated',
    ])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_xl556ba8iva0gd2qfoyk2fvifsysnq7c766sscsa18rwolofgwo6j1mwc4d5xhgmkfumr8ktberb1y177de7uxcd6v7l44b6fkhlwycl70lrxw0u7h6bdpuf595n046bp9ek87dk59o0nlruto403n7esdq6wgm3o5w425i7svaw557latsslakyjifkd1p21jwj1end/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  // it('first migration --name --force', async () => {
  //   ctx.fixture('schema-only-sqlite')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //     '--preview-feature',
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
  //   expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
  //   expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  // })

  it('snapshot of sql', async () => {
    ctx.fixture('schema-only-sqlite')

    const result = MigrateDev.new().parse(['--name=first', '--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )

    const baseDir = path.join('prisma', 'migrations')
    const migrationDirList = fs.list(baseDir)
    const migrationFilePath = path.join(
      baseDir,
      migrationDirList![0],
      'migration.sql',
    )
    const migrationFile = await fs.read(migrationFilePath)
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

    const draftResult = MigrateDev.new().parse([
      '--create-only',
      '--preview-feature',
    ])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_some_draft

            You can now edit it and apply it by running prisma migrate dev --preview-feature.
          `)

    const applyResult = MigrateDev.new().parse(['--preview-feature'])

    await expect(applyResult).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )

    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_some_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('draft migration with empty schema (prompt)', async () => {
    ctx.fixture('schema-only-sqlite')

    prompt.inject(['some-empty-Draft'])

    const draftResult = MigrateDev.new().parse([
      '--schema=./prisma/empty.prisma',
      '--create-only',
      '--preview-feature',
    ])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_some_empty_draft

            You can now edit it and apply it by running prisma migrate dev --preview-feature.
          `)

    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const draftResult = MigrateDev.new().parse([
      '--create-only',
      '--name=first',
      '--preview-feature',
    ])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev --preview-feature.
          `)

    const applyResult = MigrateDev.new().parse(['--preview-feature'])

    await expect(applyResult).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('transition-db-push-migrate (prompt reset yes)', async () => {
    ctx.fixture('transition-db-push-migrate')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"



      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('transition-db-push-migrate (prompt reset no)', async () => {
    ctx.fixture('transition-db-push-migrate')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Reset cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
    expect(mockExit).toBeCalledWith(0)
  })

  it('edited migration and unapplied empty draft', async () => {
    ctx.fixture('edited-and-draft')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"



      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_test/
          └─ migration.sql
        └─ 20201231000000_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('removed applied migration and unapplied empty draft', async () => {
    ctx.fixture('edited-and-draft')
    fs.remove('prisma/migrations/20201117144659_test')

    prompt.inject(['y', 'new-change'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"



      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_new_change/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('broken migration should fail', async () => {
    ctx.fixture('broken-migration')

    try {
      await MigrateDev.new().parse(['--preview-feature'])
    } catch (e) {
      expect(e.message).toContain(
        'Database error: Error querying the database: near "BROKEN": syntax error',
      )
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('existingdb: has a failed migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')

    try {
      await MigrateDev.new().parse(['--preview-feature'])
    } catch (e) {
      expect(e.code).toEqual('P3006')
      expect(e.message).toContain('P3006')
      expect(e.message).toContain(
        'failed to apply cleanly to a temporary database.',
      )
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('existing-db-1-migration edit migration with broken sql', async () => {
    ctx.fixture('existing-db-1-migration')

    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Already in sync, no schema change or pending migration was found.`,
    )

    // Edit with broken SQL
    fs.write(
      'prisma/migrations/20201014154943_init/migration.sql',
      'CREATE BROKEN',
    )

    try {
      await MigrateDev.new().parse(['--preview-feature'])
    } catch (e) {
      expect(e.code).toEqual('P3006')
      expect(e.message).toContain('P3006')
      expect(e.message).toContain(
        'failed to apply cleanly to a temporary database.',
      )
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 unapplied draft', async () => {
    ctx.fixture('existing-db-1-draft')
    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 unapplied draft + 1 schema change', async () => {
    ctx.fixture('existing-db-1-draft-1-change')
    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_draft/
          └─ migration.sql

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 unexecutable schema change', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).rejects.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                ⚠️ We found changes that cannot be executed:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  • Step 0 Made the column \`fullname\` on table \`Blog\` required, but there are 1 existing NULL values.

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 unexecutable schema change with --create-only should succeed', async () => {
    ctx.fixture('existing-db-1-unexecutable-schema-change')
    const result = MigrateDev.new().parse([
      '--preview-feature',
      '--create-only',
    ])

    await expect(result).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_

            You can now edit it and apply it by running prisma migrate dev --preview-feature.
          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 warning from schema change (prompt yes)', async () => {
    ctx.fixture('existing-db-1-warning')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`

                                                                                                                                                      ⚠️  There will be data loss when applying the migration:

                                                                                                                                                        • You are about to drop the \`Blog\` table, which is not empty (2 rows).
                                                                                                    `)
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: 1 warning from schema change (prompt no)', async () => {
    ctx.fixture('existing-db-1-warning')

    prompt.inject([new Error()])

    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`Migration cancelled.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`

                                                                                                                                                      ⚠️  There will be data loss when applying the migration:

                                                                                                                                                        • You are about to drop the \`Blog\` table, which is not empty (2 rows).
                                                                                                    `)
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('provider array should fail', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateDev.new().parse([
      '--schema=./prisma/provider-array.prisma',
      '--preview-feature',
    ])

    await expect(result).rejects.toMatchInlineSnapshot(`UserFacingError`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/provider-array.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(
      `Response: Datasource provider arrays are no longer supported in migrate. Please change your datasource to use a single provider. Read more at https://pris.ly/multi-provider-deprecation`,
    )
  })

  it('one seed file', async () => {
    ctx.fixture('edited-and-draft')
    fs.write('prisma/seed.js', 'console.log("Hello from generated seed")')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Running \`node seed.js\` ...

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_test/
          └─ migration.sql
        └─ 20201231000000_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchSnapshot()
  })

  it('one broken seed file', async () => {
    ctx.fixture('edited-and-draft')
    fs.write('prisma/seed.js', 'BROKENCODE;;;;;')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"


      Running \`node seed.js\` ...

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_test/
          └─ migration.sql
        └─ 20201231000000_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join()).toContain(
      'Command failed with exit code 1',
    )
  })

  it('multple seed files', async () => {
    ctx.fixture('edited-and-draft')
    fs.write('prisma/seed.sh', 'echo "Hello from generated seed"')
    fs.write('prisma/seed.js', 'console.log("Hello from generated seed")')

    prompt.inject(['y'])

    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"



      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_test/
          └─ migration.sql
        └─ 20201231000000_draft/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls.join()).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join())
      .toMatchInlineSnapshot(`
      Error: More than one seed file was found in \`prisma\` directory.
      This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.
    `)
  })
})

describe('postgresql', () => {
  const SetupParams: SetupParams = {
    connectionString:
      process.env.TEST_POSTGRES_URI_MIGRATE ||
      'postgres://prisma:prisma@localhost:5432/tests-migrate',
    dirname: './fixtures',
  }

  beforeAll(async () => {
    await tearDownPostgres(SetupParams).catch((e) => {
      console.error(e)
    })
  })

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

  it('schema only (prompt yes)', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateDev.new().parse(['--preview-feature'])
    await expect(result).resolves.toThrowErrorMatchingInlineSnapshot(
      `undefined`,
    )
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateDev.new().parse(['--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('create first migration with nativeTypes', async () => {
    ctx.fixture('nativeTypes-postgresql')

    const result = MigrateDev.new().parse(['--name=first', '--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  // it('first migration --force + --name', async () => {
  //   ctx.fixture('schema-only-postgresql')
  //   const result = MigrateDev.new().parse([
  //     '--name=first',
  //     '--force',
  //     '--preview-feature',
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
  //   expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
  //   expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  // })

  it('draft migration and apply (--name)', async () => {
    ctx.fixture('schema-only-postgresql')
    jest.setTimeout(7000)

    const draftResult = MigrateDev.new().parse([
      '--create-only',
      '--name=first',
      '--preview-feature',
    ])

    await expect(draftResult).resolves.toMatchInlineSnapshot(`
            Prisma Migrate created the following migration without applying it 20201231000000_first

            You can now edit it and apply it by running prisma migrate dev --preview-feature.
          `)

    const applyResult = MigrateDev.new().parse(['--preview-feature'])
    await expect(applyResult).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )

    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existingdb: create first migration', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateDev.new().parse(['--name=first', '--preview-feature'])

    await expect(result).resolves.toMatchInlineSnapshot(
      `Everything is now in sync.`,
    )
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate", schema "public" at "localhost:5432"

      The following migration(s) have been created and applied from new schema changes:

      migrations/
        └─ 20201231000000_first/
          └─ migration.sql
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  // it('real-world-grading-app: compare snapshot', async () => {
  //   ctx.fixture('real-world-grading-app')
  //   const result = MigrateDev.new().parse(['--preview-feature'])

  //   await expect(result).resolves.toMatchInlineSnapshot()
  //   expect(ctx.mocked['console.info'].mock.calls.join('\n'))
  //     .toMatchInlineSnapshot(`
  //     Prisma Schema loaded from prisma/schema.prisma

  //     Prisma Migrate applied the following migration(s):

  //     migrations/
  //       └─ 20201231000000_/
  //         └─ migration.sql
  //   `)

  //   expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
  //   expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  //   expect(
  //     fs.read(`prisma/${fs.list('prisma/migrations')![0]}/migration.sql`),
  //   ).toMatchSnapshot()
  // })
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
