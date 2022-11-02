import { jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs-jetpack'
import prompt from 'prompts'

import { DbPull } from '../commands/DbPull'
import { MigrateDeploy } from '../commands/MigrateDeploy'
import { MigrateDev } from '../commands/MigrateDev'
import { MigrateResolve } from '../commands/MigrateResolve'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// Disable prompts
process.env.GITHUB_ACTIONS = '1'
// Disable generate
process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

// Covered in docs: https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/add-prisma-migrate-to-a-project
// We have a dev and prod database
// And we want to baseline the production database with a baseline migration
// For that, we use `db pull`, `migrate dev`, `migrate resolve` and `migrate deploy` commands
describe('Baselining', () => {
  it('SQLite: should succeed', async () => {
    ctx.fixture('baseline-sqlite')
    fs.remove('prisma/migrations')
    fs.copy('prisma/dev.db', 'prisma/prod.db')

    // Start with the dev database
    process.env.DATABASE_URL = 'file:./dev.db'

    // db pull
    const dbPull = DbPull.new().parse([])
    await expect(dbPull).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"
    `)
    ctx.mocked['console.info'].mockReset()

    // migrate dev --create-only
    prompt.inject(['y'])
    const migrateDevCreateOnly = MigrateDev.new().parse(['--create-only'])
    await expect(migrateDevCreateOnly).resolves.toMatchInlineSnapshot(`
      Prisma Migrate created the following migration without applying it 20201231000000_

      You can now edit it and apply it by running prisma migrate dev.
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      Drift detected: Your database schema is not in sync with your migration history.

      The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

      It should be understood as the set of changes to get from the expected schema to the actual schema.

      If you are running this the first time on an existing database, please make sure to read this documentation page:
      https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development

      [+] Added tables
        - Blog


    `)
    ctx.mocked['console.info'].mockReset()

    // migrate dev
    const migrateDev = MigrateDev.new().parse([])
    await expect(migrateDev).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      Applying migration \`20201231000000_\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
    `)
    ctx.mocked['console.info'].mockReset()

    // Switch to PROD database
    process.env.DATABASE_URL = 'file:./prod.db'

    // migrate resolve --applied migration_name
    const migrationName = fs.list('prisma/migrations')![0]
    const migrateResolveProd = MigrateResolve.new().parse(['--applied', migrationName])
    await expect(migrateResolveProd).resolves.toMatchInlineSnapshot(`Migration 20201231000000_ marked as applied.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "prod.db" at "file:./prod.db"
    `)
    ctx.mocked['console.info'].mockReset()

    // migrate deploy
    const migrateDeployProd = MigrateDeploy.new().parse([])
    await expect(migrateDeployProd).resolves.toMatchInlineSnapshot(`No pending migrations to apply.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "prod.db" at "file:./prod.db"

      1 migration found in prisma/migrations


    `)

    expect(ctx.mocked['console.log'].mock.calls).toEqual([])
    expect(ctx.mocked['console.error'].mock.calls).toEqual([])
  })
})
