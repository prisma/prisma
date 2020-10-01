process.env.GITHUB_ACTIONS = '1'

import fs from 'fs-jetpack'
import { MigrateCommand } from '../commands/MigrateCommand'
import { consoleContext, Context } from './__helpers__/context'
import { tearDownMysql } from '../utils/setupMysql'
import { SetupParams, tearDownPostgres } from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

describe('common', () => {
  it('migrate in folder with schema only no migrations directory should fail', async () => {
    ctx.fixture('schema-only')
    const result = MigrateCommand.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `You need to initialize the migrations by running prisma migrate init --experimental.`,
    )
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma Schema loaded from prisma/schema.prisma`)
  })

  it('migrate should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateCommand.new().parse(['--experimental'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)
  })
})

describe('sqlite', () => {
  it('migrate first migration after init - empty schema', async () => {
    ctx.fixture('initialized-sqlite')
    const result = MigrateCommand.new().parse([
      '--schema=./prisma/empty.prisma',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                        Everything is already in sync, Prisma Migrate didn't find any schema changes or unapplied migrations.

                    `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/empty.prisma

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('migrate first migration after init', async () => {
    ctx.fixture('initialized-sqlite')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                    Prisma Migrate created and applied the migration 20201231000000_first in

                                    migrations/
                                      └─ 20201231000000_first/
                                        └─ migration.sql

                              `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('migrate first migration after init --force', async () => {
    ctx.fixture('initialized-sqlite')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--force',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                    Prisma Migrate created and applied the migration 20201231000000_first in

                                    migrations/
                                      └─ 20201231000000_first/
                                        └─ migration.sql

                              `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('create draft migration and apply', async () => {
    ctx.fixture('initialized-sqlite')
    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--name=first',
      '--experimental',
    ])
    await expect(draftResult).resolves.toMatchInlineSnapshot(`

                                                            Prisma Migrate created a draft migration 20201231000000_first

                                                            You can now edit it and then apply it by running prisma migrate --experimental again.
                                                  `)

    const applyResult = MigrateCommand.new().parse(['--experimental'])
    console.debug('hello', await applyResult)

    await expect(applyResult).resolves.toMatchInlineSnapshot(`

                                                Prisma Migrate created and applied the migration 20201231000000_first in

                                                migrations/
                                                  └─ 20201231000000_first/
                                                    └─ migration.sql

                                        `)

    expect(
      (fs.list('prisma/migrations')?.length || 0) > 0,
    ).toMatchInlineSnapshot(`true`)
    expect(fs.exists('prisma/dev.db')).toEqual('file')

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      SQLite database dev.db created at file:dev.db

      Prisma Schema loaded from prisma/schema.prisma
    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls).toMatchInlineSnapshot(
      `Array []`,
    )
  })
})

describe('posgresql', () => {
  const SetupParams: SetupParams = {
    connectionString:
      process.env.TEST_POSTGRES_URI || 'postgres://localhost:5432/prisma-dev',
    dirname: './fixtures',
  }

  beforeEach(async () => {
    await tearDownPostgres(SetupParams).catch((e) => {
      console.debug({ e })
    })
  })

  afterAll(async () => {
    await tearDownPostgres(SetupParams).catch((e) => {
      console.log(e)
    })
  })

  it('migrate first migration after init - empty schema', async () => {
    ctx.fixture('initialized-postgresql')
    const result = MigrateCommand.new().parse([
      '--schema=./prisma/empty.prisma',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

            Everything is already in sync, Prisma Migrate didn't find any schema changes or unapplied migrations.

          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/empty.prisma

      PostgreSQL database tests created at localhost:5432

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('migrate first migration after init', async () => {
    ctx.fixture('initialized-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                    Prisma Migrate created and applied the migration 20201231000000_first in

                                    migrations/
                                      └─ 20201231000000_first/
                                        └─ migration.sql

                              `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      PostgreSQL database tests created at localhost:5432

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('migrate first migration after init --force', async () => {
    ctx.fixture('initialized-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--force',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                    Prisma Migrate created and applied the migration 20201231000000_first in

                                    migrations/
                                      └─ 20201231000000_first/
                                        └─ migration.sql

                              `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      PostgreSQL database tests created at localhost:5432

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })

  it('create draft migration and apply', async () => {
    ctx.fixture('initialized-postgresql')
    const draftResult = MigrateCommand.new().parse([
      '--draft',
      '--name=first',
      '--experimental',
    ])
    await expect(draftResult).resolves.toMatchInlineSnapshot(`

            Prisma Migrate created a draft migration 20201231000000_first

            You can now edit it and then apply it by running prisma migrate --experimental again.
          `)

    const applyResult = MigrateCommand.new().parse(['--experimental'])
    await expect(applyResult).resolves.toMatchInlineSnapshot(`

            Prisma Migrate created and applied the migration 20201231000000_first in

            migrations/
              └─ 20201231000000_first/
                └─ migration.sql

          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      PostgreSQL database tests created at localhost:5432

      Prisma Schema loaded from prisma/schema.prisma
    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls).toMatchInlineSnapshot(
      `Array []`,
    )
  })

  it('existingdb: migrate first migration after init', async () => {
    ctx.fixture('initialized-postgresql')
    const result = MigrateCommand.new().parse([
      '--name=first',
      '--experimental',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

            Prisma Migrate created and applied the migration 20201231000000_first in

            migrations/
              └─ 20201231000000_first/
                └─ migration.sql

          `)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma Schema loaded from prisma/schema.prisma

      PostgreSQL database tests created at localhost:5432

    `)
    expect(ctx.mocked['console.log'].mock.calls.length).toEqual(0)
    expect(ctx.mocked['console.error'].mock.calls.length).toEqual(0)
  })
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
      console.debug({ e })
    })
  })

  afterAll(async () => {
    await tearDownMysql(SetupParams).catch((e) => {
      console.log({ e })
    })
  })
})
