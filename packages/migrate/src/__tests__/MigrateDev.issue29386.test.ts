/**
 * Issue #29386: prisma migrate infinite generation loop with varchar partial unique index
 *
 * BUG SUMMARY:
 * When using @db.VarChar type with @@unique partial unique constraints and a
 * negation predicate (where: { status: { not: "superseded" } }), prisma migrate
 * dev generates a spurious DROP + CREATE migration on EVERY run.
 *
 * ROOT CAUSE:
 * PostgreSQL normalizes the WHERE clause of a partial index on a varchar column
 * by adding ::text casts:
 * - Prisma generates: ("status" != 'superseded')
 * - PostgreSQL stores: (status)::text <> 'superseded'::text
 *
 * The schema differ doesn't account for these normalizations, causing it to
 * detect a "difference" and generate a spurious migration on every run.
 *
 * This test reproduces the bug by running migrate dev twice and verifying that
 * the second run should NOT generate a new migration (but the bug causes it to).
 */

import fs from 'fs-jetpack'
import path from 'path'
import prompt from 'prompts'

import { MigrateDev } from '../commands/MigrateDev'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'
import { createDefaultTestContext } from './__helpers__/context'

const testIf = (condition: boolean) => (condition ? test : test.skip)

const ctx = createDefaultTestContext()

describe('Issue #29386: Varchar Partial Unique Index Migration Loop', () => {
  beforeEach(() => {
    // Inject prompts to allow non-interactive testing
    prompt.inject(['yes'])
  })

  testIf(process.env.TEST_POSTGRES_URI_MIGRATE !== undefined)(
    'should NOT generate a spurious migration on second migrate dev (varchar + negation predicate)',
    async () => {
      // Set up PostgreSQL database
      const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!
      const dirname = '' // No setup script needed

      await setupPostgres({ connectionString, dirname })

      try {
        // Load the test fixture
        ctx.fixture('issue-29386-varchar-partial-unique')

        // Get config once to avoid environment reset
        const config = await ctx.config()
        const configDir = ctx.configDir()

        // First migration: should create the initial migration successfully
        await MigrateDev.new().parse(['--name=init'], config, configDir)

        // First migration should succeed (no error thrown)

        // Verify the first migration was created
        const migrationsDir = 'prisma/migrations'
        expect(fs.exists(migrationsDir)).toEqual('dir')

        // Get the migration directories that were created (filter out non-directories like migration_lock.toml)
        const allItemsInMigrations = fs.list(migrationsDir) ?? []
        const initialMigrationDirs = allItemsInMigrations.filter((item) => {
          const itemPath = path.join(migrationsDir, item)
          return fs.exists(itemPath) === 'dir'
        })
        expect(initialMigrationDirs.length).toBeGreaterThanOrEqual(1)

        // Use the last migration directory (most recent)
        const firstMigrationDir = initialMigrationDirs![initialMigrationDirs!.length - 1]
        const firstMigrationPath = path.join(migrationsDir, firstMigrationDir, 'migration.sql')
        expect(fs.exists(firstMigrationPath)).toEqual('file')

        // Read the first migration to verify it contains the expected index
        const firstMigrationContent = fs.read(firstMigrationPath)
        expect(firstMigrationContent).toContain('CREATE UNIQUE INDEX')
        expect(firstMigrationContent).toContain('Document_groupId_key')
        expect(firstMigrationContent).toMatch(/WHERE.*status.*!=.*superseded/)

        // Ensure CI mode is still enabled
        process.env.GITHUB_ACTIONS = '1'
        process.env.CI = '1'

        // Second migration: should detect NO CHANGES (this is where the BUG manifests)
        await MigrateDev.new().parse(['--name=should_not_exist'], config, configDir)

        const secondStdout = ctx.normalizedCapturedStdout()

        // Expected behavior: second run should detect no changes
        // The bug causes it to generate a spurious DROP + CREATE migration

        // Check if a new migration was created (BUG indicator)
        const allItemsAfterSecond = fs.list(migrationsDir) ?? []
        const migrationDirsAfterSecond = allItemsAfterSecond.filter((item) => {
          const itemPath = path.join(migrationsDir, item)
          return fs.exists(itemPath) === 'dir'
        })

        if (migrationDirsAfterSecond!.length > initialMigrationDirs!.length) {
          // BUG REPRODUCED: A new migration was created when it shouldn't have been
          const newMigrationDir = migrationDirsAfterSecond![migrationDirsAfterSecond!.length - 1]
          const newMigrationPath = path.join(migrationsDir, newMigrationDir, 'migration.sql')
          const newMigrationContent = fs.read(newMigrationPath)

          // The spurious migration should contain DROP + CREATE for the same index
          expect(newMigrationContent).toContain('DROP INDEX')
          expect(newMigrationContent).toContain('CREATE UNIQUE INDEX')

          // Bug reproduced - fail the test with a clear message
          throw new Error(
            `BUG REPRODUCED (#29386): Second migrate dev created a spurious migration.\n` +
              `Expected: "Already in sync" message or no new migration\n` +
              `Actual: Created migration "${newMigrationDir}" with:\n${newMigrationContent}\n` +
              `\nThis is the bug described in issue #29386.`,
          )
        }

        // If we reach here, the bug is FIXED
        // Verify that the output indicates no changes
        expect(secondStdout).toMatch(/sync|up to date|no schema change/i)
      } finally {
        // Clean up PostgreSQL database
        await tearDownPostgres({ connectionString, dirname })
      }
    },
    60000, // 60 second timeout for migration operations
  )
})
