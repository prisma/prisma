import { getSchemaPath } from '@prisma/sdk'
import { Migrate } from '../Migrate'
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
