import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs-jetpack'

import { DbPull } from '../commands/DbPull'
import { MigrateDeploy } from '../commands/MigrateDeploy'
import { MigrateDev } from '../commands/MigrateDev'
import { MigrateReset } from '../commands/MigrateReset'
import { MigrateResolve } from '../commands/MigrateResolve'
import { CaptureStdout } from '../utils/captureStdout'
import { describeOnly } from './__helpers__/conditionalTests'
import { defaultTestConfig } from './__helpers__/prismaConfig'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const captureStdout = new CaptureStdout()

// Covered in docs: https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/add-prisma-migrate-to-a-project
// We have a dev and prod database
// And we want to baseline the production database with a baseline migration
// For that, we use `db pull`, `migrate dev`, `migrate resolve` and `migrate deploy` commands
describe('Baselining', () => {
  // Backup env vars
  const OLD_ENV = { ...process.env }

  beforeEach(() => {
    captureStdout.startCapture()
    // Disable prompts
    process.env.GITHUB_ACTIONS = '1'
    // Disable generate
    process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'
  })

  afterEach(() => {
    captureStdout.clearCaptureText()
    captureStdout.stopCapture()
    // Restore env vars to backup state
    process.env = { ...OLD_ENV }
  })

  describeOnly({ sqlite: true }, 'SQLite', () => {
    it('should succeed', async () => {
      ctx.fixture('baseline-sqlite')
      fs.remove('prisma/migrations')
      fs.copy('prisma/dev.db', 'prisma/prod.db')

      // Start with the dev database
      process.env.DATABASE_URL = 'file:./dev.db'

      // db pull
      const dbPull = DbPull.new().parse([], defaultTestConfig())
      await expect(dbPull).resolves.toMatchInlineSnapshot(`""`)
      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      - Introspecting based on datasource defined in prisma/schema.prisma
      ✔ Introspected 1 model and wrote it into prisma/schema.prisma in XXXms
            
      Run prisma generate to generate Prisma Client.
      "
    `)
      captureStdout.clearCaptureText()

      // migrate reset --force
      const migrateReset = MigrateReset.new().parse(['--force'], defaultTestConfig())
      await expect(migrateReset).resolves.toMatchInlineSnapshot(`""`)
      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      Database reset successful

      "
    `)
      captureStdout.clearCaptureText()

      // migrate dev --create-only
      const migrateDevCreateOnly = MigrateDev.new().parse(['--create-only'], defaultTestConfig())
      await expect(migrateDevCreateOnly).resolves.toMatchInlineSnapshot(`
      "Prisma Migrate created the following migration without applying it 20201231000000_

      You can now edit it and apply it by running prisma migrate dev."
    `)
      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
"Prisma schema loaded from prisma/schema.prisma
Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

"
`)
      captureStdout.clearCaptureText()

      // migrate dev
      captureStdout.startCapture()
      const migrateDev = MigrateDev.new().parse([], defaultTestConfig())
      await expect(migrateDev).resolves.toMatchInlineSnapshot(`""`)
      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:./dev.db"

      Applying migration \`20201231000000_\`

      The following migration(s) have been applied:

      migrations/
        └─ 20201231000000_/
          └─ migration.sql

      Your database is now in sync with your schema.
      "
    `)
      captureStdout.clearCaptureText()

      // Switch to PROD database
      process.env.DATABASE_URL = 'file:./prod.db'

      // migrate resolve --applied migration_name
      const migrationName = fs.list('prisma/migrations')![0]
      const migrateResolveProd = MigrateResolve.new().parse(['--applied', migrationName], defaultTestConfig())
      await expect(migrateResolveProd).resolves.toMatchInlineSnapshot(`""`)

      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "prod.db" at "file:./prod.db"

      Migration 20201231000000_ marked as applied.
      "
    `)
      captureStdout.clearCaptureText()

      // migrate deploy
      const migrateDeployProd = MigrateDeploy.new().parse([], defaultTestConfig())
      await expect(migrateDeployProd).resolves.toMatchInlineSnapshot(`"No pending migrations to apply."`)
      expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "prod.db" at "file:./prod.db"

      1 migration found in prisma/migrations


      "
    `)

      expect(ctx.mocked['console.log'].mock.calls).toEqual([])
      expect(ctx.mocked['console.error'].mock.calls).toEqual([])
    })
  })
})
