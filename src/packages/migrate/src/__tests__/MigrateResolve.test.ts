import prompt from 'prompts'
import fs from 'fs-jetpack'
import path from 'path'
import { MigrateResolve } from '../commands/MigrateResolve'
import { consoleContext, Context } from './__helpers__/context'
import { tearDownMysql } from '../utils/setupMysql'
import {
  SetupParams,
  setupPostgres,
  tearDownPostgres,
} from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

process.env.GITHUB_ACTIONS = '1'
// process.env.MIGRATE_SKIP_GENERATE = '1'

describe('common', () => {
  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Could not find a schema.prisma file that is required for this command.
            You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
          `)
  })
  it('should fail if no flag', async () => {
    ctx.fixture('empty')
    const result = MigrateResolve.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Early Access. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --early-access-feature flag to use this command.
          `)
  })
})

describe('sqlite', () => {
  it('should fail if no sqlite db - empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse([
      '--schema=./prisma/empty.prisma',
      '--early-access-feature',
    ])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/empty.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-failed-migration (prompt cancelled)', async () => {
    ctx.fixture('existing-db-1-failed-migration')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma


      Resolve cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()

    expect(mockExit).toBeCalledWith(0)
  })

  it('existing-db-1-failed-migration (prompt markrolledback)', async () => {
    ctx.fixture('existing-db-1-failed-migration')

    prompt.inject(['markrolledback'])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as rolled back.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-failed-migration (prompt markapplied)', async () => {
    ctx.fixture('existing-db-1-failed-migration')

    prompt.inject(['markapplied'])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Migration 20201231000000_failed marked as applied.`,
    )

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('baseline-sqlite (prompt yes)', async () => {
    ctx.fixture('baseline-sqlite')

    prompt.inject(['y'])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Resolve successful, 20201231000000_ is now the the baseline migration for the database.`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('baseline-sqlite (prompt cancelled)', async () => {
    // TODO need to see what's happening
    ctx.fixture('baseline-sqlite')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Resolve cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()

    expect(mockExit).toBeCalledWith(0)
  })

  it('existing-db-1-migration', async () => {
    ctx.fixture('existing-db-1-migration')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`Nothing to resolve.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-migration-conflict (prompt)', async () => {
    ctx.fixture('existing-db-1-migration-conflict')

    prompt.inject(['y'])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(
      `Resolve successful, 20201231000000_init is now the the baseline migration for the database.`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-1-migration-conflict (prompt cancelled)', async () => {
    ctx.fixture('existing-db-1-migration-conflict')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    prompt.inject([new Error()])

    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      Resolve cancelled.
    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
    expect(mockExit).toBeCalledWith(0)
  })

  it('existing-db-brownfield', async () => {
    ctx.fixture('existing-db-brownfield')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Check init flow with introspect + SQL schema dump (TODO docs)`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('existing-db-warnings', async () => {
    ctx.fixture('existing-db-warnings')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Check init flow with introspect + SQL schema dump (TODO docs)`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('old-migrate', async () => {
    ctx.fixture('old-migrate')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('initialized-sqlite', async () => {
    ctx.fixture('initialized-sqlite')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('reset', async () => {
    ctx.fixture('reset')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`Nothing to resolve.`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

    `)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })

  it('schema-only-sqlite', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateResolve.new().parse(['--early-access-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `P1003: SQLite database file doesn't exist`,
    )

    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(ctx.mocked['console.log'].mock.calls).toMatchSnapshot()
    expect(ctx.mocked['console.error'].mock.calls).toMatchSnapshot()
  })
})

// describe('postgresql', () => {
//   const SetupParams: SetupParams = {
//     connectionString:
//       process.env.TEST_POSTGRES_URI_MIGRATE ||
//       'postgres://prisma:prisma@localhost:5432/tests-migrate',
//     dirname: './fixtures',
//   }

//   beforeEach(async () => {
//     await setupPostgres(SetupParams).catch((e) => {
//       console.error(e)
//     })
//   })

//   afterEach(async () => {
//     await tearDownPostgres(SetupParams).catch((e) => {
//       console.error(e)
//     })
//   })

// })
