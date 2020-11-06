import { getSchemaPath } from '@prisma/sdk'
import { Migrate } from '../Migrate'
import path from 'path'
import fs from 'fs-jetpack'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

it('getDatabaseVersion', async () => {
  ctx.fixture('schema-only')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.getDatabaseVersion()
  await expect(result).resolves.toContain('PostgreSQL')
  migrate.stop()
})

// migration is not yet applied
it('evaluateDataLoss - schema-only-sqlite', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = migrate.engine.evaluateDataLoss({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    prismaSchema: datamodel,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            migrationSteps: Array [
              CREATE TABLE "Blog" (
              "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
              "viewCount20" INTEGER NOT NULL
          ),
            ],
            unexecutableSteps: Array [],
            warnings: Array [],
          }
        `)
  migrate.stop()
})

// migration is already applied so should be empty
it('evaluateDataLoss - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = migrate.engine.evaluateDataLoss({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    prismaSchema: datamodel,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            migrationSteps: Array [],
            unexecutableSteps: Array [],
            warnings: Array [],
          }
        `)
  migrate.stop()
})

it('createMigration - existing-db-1-migration', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = migrate.engine.createMigration({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: 'my_migration',
    draft: false,
    prismaSchema: datamodel,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            generatedMigrationName: 20201231000000_my_migration,
          }
        `)
  migrate.stop()
})

it('createMigration draft - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = migrate.engine.createMigration({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: 'draft_123',
    draft: true,
    prismaSchema: datamodel,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            generatedMigrationName: 20201231000000_draft_123,
          }
        `)
  migrate.stop()
})

it('diagnoseMigrationHistory - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.diagnoseMigrationHistory({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            drift: null,
            editedMigrationNames: Array [],
            failedMigrationNames: Array [],
            hasMigrationsTable: true,
            history: null,
          }
        `)
  migrate.stop()
})

it('applyMigrations', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.applyMigrations({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            appliedMigrationNames: Array [],
          }
        `)
  migrate.stop()
})

//
it('applyMigrations - should fail on existing brownfield db', async () => {
  ctx.fixture('existing-db-brownfield')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.applyMigrations({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })

  await expect(result).rejects.toMatchInlineSnapshot(`
          P3005

          The database schema for \`dev.db\` is not empty. Please follow the to-be-written instructions on how to set up migrate with an existing database, or use an empty database.

        `)
  migrate.stop()
})

it('push', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = migrate.engine.schemaPush({
    force: false,
    schema: datamodel,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            executedSteps: 1,
            unexecutable: Array [],
            warnings: Array [],
          }
        `)
  migrate.stop()
})

it('push should return executedSteps 0 with warning if dataloss detected', async () => {
  ctx.fixture('existing-db-brownfield')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()

  const result = migrate.engine.schemaPush({
    force: false,
    schema: datamodel.replace('Blog', 'Something'),
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            executedSteps: 0,
            unexecutable: Array [],
            warnings: Array [
              You are about to drop the \`Blog\` table, which is not empty (1 rows).,
            ],
          }
        `)
  migrate.stop()
})

it('push force should accept dataloss', async () => {
  ctx.fixture('existing-db-brownfield')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()

  const result = migrate.engine.schemaPush({
    force: true,
    schema: datamodel.replace('Blog', 'Something'),
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            executedSteps: 2,
            unexecutable: Array [],
            warnings: Array [
              You are about to drop the \`Blog\` table, which is not empty (1 rows).,
            ],
          }
        `)
  migrate.stop()
})

it('markMigrationRolledBack - should fail - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)

  const resultMarkRolledBacked = migrate.engine.markMigrationRolledBack({
    migrationName: '20201014154943_init',
  })

  await expect(resultMarkRolledBacked).rejects.toMatchInlineSnapshot(`
          Generic error: Migration \`20201231000000_init\` cannot be rolled back because it is not in a failed state.

        `)

  migrate.stop()
})

it('markMigrationRolledBack - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = await migrate.engine.createMigration({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: 'draft_123',
    draft: true,
    prismaSchema: datamodel,
  })

  expect(result).toMatchInlineSnapshot(`
          Object {
            generatedMigrationName: 20201231000000_draft_123,
          }
        `)

  fs.write(
    path.join(
      migrate.migrationsDirectoryPath,
      result.generatedMigrationName!,
      'migration.sql',
    ),
    'SELECT KAPUTT',
  )

  const resultApply = migrate.engine.applyMigrations({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })

  await expect(resultApply).rejects.toMatchInlineSnapshot(`
          Error querying the database: Error accessing result set, column not found: KAPUTT
             0: migration_core::commands::apply_migrations::Applying migration
                     with migration_name="20201231000000_draft_123"
                       at migration-engine/core/src/commands/apply_migrations.rs:69
             1: migration_core::api::ApplyMigrations
                       at migration-engine/core/src/api.rs:98

        `)

  const resultMarkRolledBacked = migrate.engine.markMigrationRolledBack({
    migrationName: result.generatedMigrationName!,
  })

  await expect(resultMarkRolledBacked).resolves.toMatchInlineSnapshot(
    `Object {}`,
  )

  const resultMarkAppliedFailed = migrate.engine.markMigrationApplied({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: result.generatedMigrationName!,
    // Do we expect to find the migration in a failed state in the migrations table?
    expectFailed: false,
  })

  await expect(resultMarkAppliedFailed).rejects.toMatchInlineSnapshot(`
          Generic error: Invariant violation: expect_failed was passed but no failed migration was found in the database.

        `)

  const resultMarkApplied = migrate.engine.markMigrationApplied({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: result.generatedMigrationName!,
    // Do we expect to find the migration in a failed state in the migrations table?
    expectFailed: true,
  })

  await expect(resultMarkApplied).resolves.toMatchInlineSnapshot(`Object {}`)

  migrate.stop()
})

it('markMigrationApplied - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = await migrate.getDatamodel()
  const result = await migrate.engine.createMigration({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: 'draft_123',
    draft: true,
    prismaSchema: datamodel,
  })

  expect(result).toMatchInlineSnapshot(`
          Object {
            generatedMigrationName: 20201231000000_draft_123,
          }
        `)

  const resultMarkApplied = migrate.engine.markMigrationApplied({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: result.generatedMigrationName!,
    // Do we expect to find the migration in a failed state in the migrations table?
    expectFailed: false,
  })

  await expect(resultMarkApplied).resolves.toMatchInlineSnapshot(`Object {}`)

  migrate.stop()
})

it('applyScript - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.applyScript({
    script: `create table teams (
      id int primary key not null,
      name varchar(50) not null unique
    );
    insert into teams (id, name) values (1, 'a');
    insert into teams (id, name) values (2, 'b');`,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`Object {}`)

  const datamodel = await migrate.getDatamodel()
  const pushResult = migrate.engine.schemaPush({
    force: false,
    schema: datamodel,
  })

  await expect(pushResult).resolves.toMatchInlineSnapshot(`
          Object {
            executedSteps: 0,
            unexecutable: Array [],
            warnings: Array [
              You are about to drop the \`teams\` table, which is not empty (2 rows).,
            ],
          }
        `)

  migrate.stop()
})

it('applyScript - error', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.applyScript({
    script: `InCORRECT SQL;;;`,
  })

  await expect(result).rejects.toThrow()

  migrate.stop()
})
