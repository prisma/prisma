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
  const datamodel = migrate.getDatamodel()
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
  const datamodel = migrate.getDatamodel()
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
  const datamodel = migrate.getDatamodel()
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
  const datamodel = migrate.getDatamodel()
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

it('diagnoseMigrationHistory - optInToShadowDatabase true - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.diagnoseMigrationHistory({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    optInToShadowDatabase: true,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            editedMigrationNames: Array [],
            failedMigrationNames: Array [],
            hasMigrationsTable: true,
            history: null,
          }
        `)
  migrate.stop()
})

it('diagnoseMigrationHistory - optInToShadowDatabase false - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.diagnoseMigrationHistory({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    optInToShadowDatabase: false,
  })

  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
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

          The database schema for \`dev.db\` is not empty. Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline

        `)
  migrate.stop()
})

it('push', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = migrate.getDatamodel()
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
  const datamodel = migrate.getDatamodel()

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
  const datamodel = migrate.getDatamodel()

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
  jest.setTimeout(10000)
  ctx.fixture('existing-db-1-migration')

  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)

  const resultMarkRolledBacked = migrate.engine.markMigrationRolledBack({
    migrationName: '20201014154943_init',
  })

  await expect(resultMarkRolledBacked).rejects.toMatchInlineSnapshot(`
          P3012

          Migration \`20201231000000_init\` cannot be rolled back because it is not in a failed state.

        `)

  migrate.stop()
})

it('markMigrationRolledBack - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = migrate.getDatamodel()
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
    'SELECT SOMETHING_THAT_DOES_NOT_WORK',
  )

  try {
    await migrate.engine.applyMigrations({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    })
  } catch (e) {
    expect(e.message).toContain('no such column: SOMETHING_THAT_DOES_NOT_WORK')
  }

  const resultMarkRolledBacked = migrate.engine.markMigrationRolledBack({
    migrationName: result.generatedMigrationName!,
  })

  await expect(resultMarkRolledBacked).resolves.toMatchSnapshot()

  const resultMarkAppliedFailed = migrate.engine.markMigrationApplied({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: result.generatedMigrationName!,
  })

  await expect(resultMarkAppliedFailed).resolves.toMatchSnapshot()

  const resultMarkApplied = migrate.engine.markMigrationApplied({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
    migrationName: result.generatedMigrationName!,
  })

  await expect(resultMarkApplied).rejects.toMatchInlineSnapshot(`
          P3008

          The migration \`20201231000000_draft_123\` is already recorded as applied in the database.

        `)

  migrate.stop()
})

it('markMigrationApplied - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const datamodel = migrate.getDatamodel()
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
  })

  await expect(resultMarkApplied).resolves.toMatchInlineSnapshot(`Object {}`)

  migrate.stop()
})

it('listMigrationDirectories - existing-db-1-migration', async () => {
  ctx.fixture('existing-db-1-migration')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.listMigrationDirectories({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })
  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            migrations: Array [
              20201231000000_init,
            ],
          }
        `)

  migrate.stop()
})

it('listMigrationDirectories - schema-only-sqlite', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.listMigrationDirectories({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })
  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            migrations: Array [],
          }
        `)

  migrate.stop()
})

it('devDiagnostic - createMigration', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.devDiagnostic({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })
  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            action: Object {
              tag: createMigration,
            },
          }
        `)

  migrate.stop()
})

it('devDiagnostic - reset because drift', async () => {
  ctx.fixture('existing-db-1-migration-conflict')
  const schemaPath = (await getSchemaPath())!
  const migrate = new Migrate(schemaPath)
  const result = migrate.engine.devDiagnostic({
    migrationsDirectoryPath: migrate.migrationsDirectoryPath,
  })
  await expect(result).resolves.toMatchInlineSnapshot(`
          Object {
            action: Object {
              reason: Drift detected: Your database schema is not in sync with your migration history.,
              tag: reset,
            },
          }
        `)

  migrate.stop()
})
