import { jestConsoleContext, jestContext } from '@prisma/internals'

import { MigrateStatus } from '../commands/MigrateStatus'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if experimental flag', async () => {
    ctx.fixture('empty')
    const result = MigrateStatus.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was Experimental and is now Generally Available.
            WARNING this new version has some breaking changes to use it it's recommended to read the documentation first and remove the --experimental flag.
          `)
  })
  it('should fail if early access flag', async () => {
    ctx.fixture('empty')
    const result = MigrateStatus.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Prisma Migrate was in Early Access and is now Generally Available.
            Remove the --early-access-feature flag.
          `)
  })
})

describe('sqlite', () => {
  it('should fail if no sqlite db - empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateStatus.new().parse(['--schema=./prisma/empty.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`P1003: Database dev.db does not exist at dev.db`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/empty.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('existing-db-1-failed-migration', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 1`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      1 migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Following migration have failed:
      20201231000000_failed

      During development if the failed migration(s) have not been deployed to a production database you can then fix the migration(s) and run prisma migrate dev.

      The failed migration(s) can be marked as rolled back or applied:
            
      - If you rolled back the migration(s) manually:
      prisma migrate resolve --rolled-back "20201231000000_failed"

      - If you fixed the database manually (hotfix):
      prisma migrate resolve --applied "20201231000000_failed"

      Read more about how to resolve migration issues in a production database:
      https://pris.ly/d/migrate-resolve
    `)
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('baseline-sqlite', async () => {
    ctx.fixture('baseline-sqlite')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 1`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      1 migration found in prisma/migrations

      Following migration have not yet been applied:
      20201231000000_

      To apply migrations in development run prisma migrate dev.
      To apply migrations in production run prisma migrate deploy.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateStatus.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(`Database schema is up to date!`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      1 migration found in prisma/migrations


    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('existing-db-1-migration-conflict', async () => {
    ctx.fixture('existing-db-1-migration-conflict')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 1`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      1 migration found in prisma/migrations

      Following migration have not yet been applied:
      20201231000000_init

      To apply migrations in development run prisma migrate dev.
      To apply migrations in production run prisma migrate deploy.
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  it('existing-db-brownfield', async () => {
    ctx.fixture('existing-db-brownfield')
    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Read more about how to baseline an existing production database:
            https://pris.ly/d/migrate-baseline
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      No migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('existing-db-warnings', async () => {
    ctx.fixture('existing-db-warnings')
    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Read more about how to baseline an existing production database:
            https://pris.ly/d/migrate-baseline
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      No migration found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('old-migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

            Read more about how to upgrade to the new version of Migrate:
            https://pris.ly/d/migrate-upgrade
          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('reset', async () => {
    ctx.fixture('reset')
    const result = MigrateStatus.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(`Database schema is up to date!`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      1 migration found in prisma/migrations


    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })

  it('existing-db-histories-diverge', async () => {
    ctx.fixture('existing-db-histories-diverge')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    const result = MigrateStatus.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 1`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"
      2 migrations found in prisma/migrations

    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Your local migration history and the migrations table from your database are different:

      The last common migration is: 20201231000000_init

      The migration have not yet been applied:
      20201231000000_catage

      The migration from the database are not found locally in prisma/migrations:
      20201231000000_dogage
    `)
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })
})

describe('postgresql', () => {
  it('should fail if cannot connect', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateStatus.new().parse(['--schema=./prisma/invalid-url.prisma'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      P1001: Can't reach database server at \`doesnotexist\`:\`5432\`

      Please make sure your database server is running at \`doesnotexist\`:\`5432\`.
    `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/invalid-url.prisma
      Datasource "my_db": PostgreSQL database "mydb", schema "public" at "doesnotexist:5432"
    `)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchSnapshot()
  })
})
