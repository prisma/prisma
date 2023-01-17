import { getSchemaPath, jestConsoleContext, jestContext } from '@prisma/internals'
import fs from 'fs-jetpack'
import path from 'path'

import { Migrate } from '../Migrate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('applyMigrations', () => {
  it('should succeed', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.applyMigrations({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        appliedMigrationNames: [],
      }
    `)
    migrate.stop()
  })

  it('should fail on existing brownfield db', async () => {
    ctx.fixture('existing-db-brownfield')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.applyMigrations({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })

    await expect(result).rejects.toMatchInlineSnapshot(`
      P3005

      The database schema is not empty. Read more about how to baseline an existing production database: https://pris.ly/d/migrate-baseline

    `)
    migrate.stop()
  })
})

describe('createDatabase', () => {
  it('should succeed - ConnectionString - sqlite', async () => {
    ctx.fixture('schema-only-sqlite')
    const migrate = new Migrate()
    const result = migrate.engine.createDatabase({
      datasource: {
        tag: 'ConnectionString',
        url: 'file:dev.db',
      },
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        databaseName: dev.db,
      }
    `)
    migrate.stop()
  })

  it('should succeed - SchemaPath - postgresql', async () => {
    ctx.fixture('schema-only')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate()
    const result = migrate.engine.createDatabase({
      datasource: {
        tag: 'SchemaPath',
        path: schemaPath,
      },
    })

    await expect(result).rejects.toMatchInlineSnapshot(`
      P1009

      Database \`tests\` already exists on the database server at \`localhost:5432\`

    `)
    migrate.stop()
  })
})

describe('createMigration', () => {
  it('should succeed - existing-db-1-migration', async () => {
    ctx.fixture('schema-only-sqlite')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.createMigration({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: 'my_migration',
      draft: false,
      prismaSchema: schema,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        generatedMigrationName: 20201231000000_my_migration,
      }
    `)
    migrate.stop()
  })

  it('draft should succeed - existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.createMigration({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: 'draft_123',
      draft: true,
      prismaSchema: schema,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        generatedMigrationName: 20201231000000_draft_123,
      }
    `)
    migrate.stop()
  })
})

describe('dbExecute', () => {
  it('should succeed - sqlite', async () => {
    ctx.fixture('schema-only-sqlite')
    const migrate = new Migrate()
    const result = migrate.engine.dbExecute({
      datasourceType: {
        tag: 'url',
        url: 'file:dev.db',
      },
      script: `-- CreateTable
      SELECT 1
      `,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`null`)
    migrate.stop()
  })
})

describe('devDiagnostic', () => {
  it('createMigration', async () => {
    ctx.fixture('schema-only-sqlite')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.devDiagnostic({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })
    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        action: {
          tag: createMigration,
        },
      }
    `)

    migrate.stop()
  })

  it('reset because drift', async () => {
    ctx.fixture('existing-db-1-migration-conflict')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.devDiagnostic({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })
    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        action: {
          reason: Drift detected: Your database schema is not in sync with your migration history.

      The following is a summary of the differences between the expected database schema given your migrations files, and the actual schema of the database.

      It should be understood as the set of changes to get from the expected schema to the actual schema.

      If you are running this the first time on an existing database, please make sure to read this documentation page:
      https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/troubleshooting-development

      [+] Added tables
        - Blog
        - _Migration
      ,
          tag: reset,
        },
      }
    `)

    migrate.stop()
  })
})

describe('diagnoseMigrationHistory', () => {
  it('optInToShadowDatabase true should succeed - existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.diagnoseMigrationHistory({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      optInToShadowDatabase: true,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        editedMigrationNames: [],
        failedMigrationNames: [],
        hasMigrationsTable: true,
        history: null,
      }
    `)
    migrate.stop()
  })

  it(' optInToShadowDatabase false should succeed - existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.diagnoseMigrationHistory({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      optInToShadowDatabase: false,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        editedMigrationNames: [],
        failedMigrationNames: [],
        hasMigrationsTable: true,
        history: null,
      }
    `)
    migrate.stop()
  })
})

describe('ensureConnectionValidity', () => {
  it('should succeed when database exists - SQLite', async () => {
    ctx.fixture('schema-only-sqlite')
    ctx.fs.write('dev.db', '')
    const migrate = new Migrate()
    const result = migrate.engine.ensureConnectionValidity({
      datasource: {
        tag: 'ConnectionString',
        url: 'file:dev.db',
      },
    })

    await expect(result).resolves.toMatchInlineSnapshot(`{}`)
    migrate.stop()
  })

  it('should succeed when database exists - PostgreSQL', async () => {
    ctx.fixture('schema-only')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate()
    const result = migrate.engine.ensureConnectionValidity({
      datasource: {
        tag: 'SchemaPath',
        path: schemaPath,
      },
    })

    await expect(result).resolves.toMatchInlineSnapshot(`{}`)
    migrate.stop()
  })

  it('should fail when database does not exist - SQLite', async () => {
    ctx.fixture('schema-only-sqlite')
    const migrate = new Migrate()
    const result = migrate.engine.ensureConnectionValidity({
      datasource: {
        tag: 'ConnectionString',
        url: 'file:dev.db',
      },
    })

    await expect(result).rejects.toMatchInlineSnapshot(`
      P1003

      Database dev.db does not exist at dev.db

    `)
    migrate.stop()
  })

  it('should fail when server does not exist - PostgreSQL', async () => {
    ctx.fixture('schema-only-sqlite')
    const migrate = new Migrate()
    const result = migrate.engine.ensureConnectionValidity({
      datasource: {
        tag: 'ConnectionString',
        url: 'postgresql://server-does-not-exist:5432/db-does-not-exist',
      },
    })

    await expect(result).rejects.toMatchInlineSnapshot(`
      P1001

      Can't reach database server at \`server-does-not-exist\`:\`5432\`

      Please make sure your database server is running at \`server-does-not-exist\`:\`5432\`.

    `)
    migrate.stop()
  })
})

describe('evaluateDataLoss', () => {
  // migration is not yet applied
  it('should succeed - schema-only-sqlite', async () => {
    ctx.fixture('schema-only-sqlite')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.evaluateDataLoss({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      prismaSchema: schema,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        migrationSteps: 1,
        unexecutableSteps: [],
        warnings: [],
      }
    `)
    migrate.stop()
  })

  // migration is already applied so should be empty
  it('should succeed - existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.evaluateDataLoss({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      prismaSchema: schema,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        migrationSteps: 0,
        unexecutableSteps: [],
        warnings: [],
      }
    `)
    migrate.stop()
  })
})

// TODO: uncomment once https://github.com/prisma/prisma-private/issues/203 is closed.
// describe('getDatabaseVersion', () => {
//   it('should succeed - PostgreSQL', async () => {
//     ctx.fixture('schema-only')
//     const schemaPath = (await getSchemaPath())!
//     const migrate = new Migrate(schemaPath)
//     const result = migrate.engine.getDatabaseVersion({ schema: schemaPath })
//     await expect(result).resolves.toContain('PostgreSQL')
//     migrate.stop()
//   })
// })

describe('listMigrationDirectories', () => {
  it('should succeed - existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.listMigrationDirectories({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })
    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        migrations: [
          20201231000000_init,
        ],
      }
    `)

    migrate.stop()
  })

  it('should succeed - schema-only-sqlite', async () => {
    ctx.fixture('schema-only-sqlite')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const result = migrate.engine.listMigrationDirectories({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
    })
    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        migrations: [],
      }
    `)

    migrate.stop()
  })
})

describe('markMigrationRolledBack', () => {
  it('should fail - existing-db-1-migration', async () => {
    jest.setTimeout(10_000)
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

  it('existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = await migrate.engine.createMigration({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: 'draft_123',
      draft: true,
      prismaSchema: schema,
    })

    expect(result).toMatchInlineSnapshot(`
      {
        generatedMigrationName: 20201231000000_draft_123,
      }
    `)

    fs.write(
      path.join(migrate.migrationsDirectoryPath!, result.generatedMigrationName!, 'migration.sql'),
      'SELECT SOMETHING_THAT_DOES_NOT_WORK',
    )

    try {
      await migrate.engine.applyMigrations({
        migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      })
    } catch (e) {
      expect(e.message).toContain('no such column: SOMETHING_THAT_DOES_NOT_WORK')
    }

    const resultMarkRolledBacked = migrate.engine.markMigrationRolledBack({
      migrationName: result.generatedMigrationName!,
    })

    await expect(resultMarkRolledBacked).resolves.toMatchSnapshot()

    const resultMarkAppliedFailed = migrate.engine.markMigrationApplied({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: result.generatedMigrationName!,
    })

    await expect(resultMarkAppliedFailed).resolves.toMatchSnapshot()

    const resultMarkApplied = migrate.engine.markMigrationApplied({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: result.generatedMigrationName!,
    })

    await expect(resultMarkApplied).rejects.toMatchInlineSnapshot(`
          P3008

          The migration \`20201231000000_draft_123\` is already recorded as applied in the database.

        `)

    migrate.stop()
  })
})

describe('markMigrationApplied', () => {
  it('existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = await migrate.engine.createMigration({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: 'draft_123',
      draft: true,
      prismaSchema: schema,
    })

    expect(result).toMatchInlineSnapshot(`
      {
        generatedMigrationName: 20201231000000_draft_123,
      }
    `)

    const resultMarkApplied = migrate.engine.markMigrationApplied({
      migrationsDirectoryPath: migrate.migrationsDirectoryPath!,
      migrationName: result.generatedMigrationName!,
    })

    await expect(resultMarkApplied).resolves.toMatchInlineSnapshot(`{}`)

    migrate.stop()
  })
})

describe('schemaPush', () => {
  // The Prisma CLI creates the SQLite database file if it doesn't exist before calling the RPC
  it('should throw if SQLite database file is missing', async () => {
    ctx.fixture('schema-only-sqlite')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.schemaPush({
      force: false,
      schema: schema,
    })

    await expect(result).rejects.toMatchInlineSnapshot(`
          P1003

          Database dev.db does not exist at dev.db

      `)
    migrate.stop()
  })

  it('should succeed without warning', async () => {
    ctx.fixture('existing-db-1-draft')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()
    const result = migrate.engine.schemaPush({
      force: false,
      schema: schema,
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        executedSteps: 1,
        unexecutable: [],
        warnings: [],
      }
    `)
    migrate.stop()
  })

  it('should return executedSteps 0 with warning if dataloss detected', async () => {
    ctx.fixture('existing-db-brownfield')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()

    const result = migrate.engine.schemaPush({
      force: false,
      schema: schema.replace('Blog', 'Something'),
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        executedSteps: 0,
        unexecutable: [],
        warnings: [
          You are about to drop the \`Blog\` table, which is not empty (1 rows).,
        ],
      }
    `)
    migrate.stop()
  })

  it('force should accept dataloss', async () => {
    ctx.fixture('existing-db-brownfield')
    const schemaPath = (await getSchemaPath())!
    const migrate = new Migrate(schemaPath)
    const schema = migrate.getPrismaSchema()

    const result = migrate.engine.schemaPush({
      force: true,
      schema: schema.replace('Blog', 'Something'),
    })

    await expect(result).resolves.toMatchInlineSnapshot(`
      {
        executedSteps: 2,
        unexecutable: [],
        warnings: [
          You are about to drop the \`Blog\` table, which is not empty (1 rows).,
        ],
      }
    `)
    migrate.stop()
  })
})
