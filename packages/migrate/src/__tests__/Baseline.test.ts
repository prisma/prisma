import fs from 'fs-jetpack'

import { DbPull } from '../commands/DbPull'
import { MigrateDeploy } from '../commands/MigrateDeploy'
import { MigrateDev } from '../commands/MigrateDev'
import { MigrateReset } from '../commands/MigrateReset'
import { MigrateResolve } from '../commands/MigrateResolve'
import { allDriverAdapters, describeMatrix } from './__helpers__/conditionalTests'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

// Covered in docs: https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/add-prisma-migrate-to-a-project
// We have a dev and prod database
// And we want to baseline the production database with a baseline migration
// For that, we use `db pull`, `migrate dev`, `migrate resolve` and `migrate deploy` commands
describe('Baselining', () => {
  beforeEach(() => {
    // Disable prompts
    process.env.GITHUB_ACTIONS = '1'
    // Disable generate
    process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'
  })

  describeMatrix({ providers: { sqlite: true }, driverAdapters: allDriverAdapters }, 'SQLite', () => {
    it('should succeed', async () => {
      ctx.fixture('baseline-sqlite')
      fs.remove('prisma/migrations')
      fs.copy('dev.db', 'prod.db')

      // Start with the dev database
      process.env.DATABASE_URL = 'file:../dev.db'

      // db pull
      const dbPull = DbPull.new().parse([], await ctx.config())
      await expect(dbPull).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "dev.db" <location placeholder>

        - Introspecting based on datasource defined in prisma/schema.prisma
        ✔ Introspected 1 model and wrote it into prisma/schema.prisma in XXXms
              
        Run prisma generate to generate Prisma Client.
        "
      `)
      ctx.clearCapturedStderr()
      ctx.clearCapturedStdout()

      // migrate reset --force
      const migrateReset = MigrateReset.new().parse(['--force'], await ctx.config())
      await expect(migrateReset).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "dev.db" <location placeholder>

        Database reset successful

        "
      `)
      ctx.clearCapturedStderr()
      ctx.clearCapturedStdout()

      // migrate dev --create-only
      const migrateDevCreateOnly = MigrateDev.new().parse(['--create-only'], await ctx.config())
      await expect(migrateDevCreateOnly).resolves.toMatchInlineSnapshot(`
        "Prisma Migrate created the following migration without applying it 20201231000000_

        You can now edit it and apply it by running prisma migrate dev."
      `)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "dev.db" <location placeholder>

        "
      `)
      ctx.clearCapturedStderr()
      ctx.clearCapturedStdout()

      // migrate dev
      const migrateDev = MigrateDev.new().parse([], await ctx.config())
      await expect(migrateDev).resolves.toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "dev.db" <location placeholder>


        The following migration(s) have been applied:

        migrations/
          └─ 20201231000000_/
            └─ migration.sql

        Your database is now in sync with your schema.
        "
      `)
      ctx.clearCapturedStderr()
      ctx.clearCapturedStdout()

      // Switch to PROD database
      process.env.DATABASE_URL = 'file:../prod.db'

      // migrate resolve --applied migration_name
      const migrationName = fs.list('prisma/migrations')![0]
      const migrateResolveProd = MigrateResolve.new().parse(['--applied', migrationName], await ctx.config())
      await expect(migrateResolveProd).resolves.toMatchInlineSnapshot(`""`)

      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "prod.db" <location placeholder>

        Migration 20201231000000_ marked as applied.
        "
      `)
      ctx.clearCapturedStderr()
      ctx.clearCapturedStdout()

      // migrate deploy
      const migrateDeployProd = MigrateDeploy.new().parse([], await ctx.config())
      await expect(migrateDeployProd).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)
      expect(ctx.normalizedCapturedStderr()).toMatchInlineSnapshot(`""`)
      expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
        "Prisma schema loaded from prisma/schema.prisma
        Datasource "my_db": SQLite database "prod.db" <location placeholder>

        1 migration found in prisma/migrations


        "
      `)

      expect(ctx.mocked['console.log'].mock.calls).toEqual([])
      expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    })
  })
})
