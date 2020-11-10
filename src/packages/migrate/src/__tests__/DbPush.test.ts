process.env.GITHUB_ACTIONS = '1'
process.env.MIGRATE_SKIP_GENERATE = '1'

import { DbPush } from '../commands/DbPush'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

let stdin
beforeEach(() => {
  stdin = require('mock-stdin').stdin()
})

describe('push', () => {
  it('requires --preview-feature flag', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
                  Please provide the --preview-feature flag to use this command.
          `)
  })

  it('if no schema file should fail', async () => {
    ctx.fixture('empty')

    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
                      Could not find a schema.prisma file that is required for this command.
                      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
                  `)
  })

  it('already in sync', async () => {
    ctx.fixture('reset')

    // setTimeout(() => stdin.send(`y\r`), 100)
    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      The database is already in sync with the Prisma schema.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('missing db', async () => {
    ctx.fixture('reset')
    ctx.fs.remove('prisma/dev.db')

    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  // commented because can't run on CI
  it.skip('should be cancelled if user send n', async () => {
    ctx.fixture('reset')
    const mockExit = jest.spyOn(process, 'exit').mockImplementation()

    // setTimeout(() => stdin.send(`n\r`), 100)
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(mockExit).toBeCalledWith(0)
  })

  it('should ask for --force if not provided', async () => {
    ctx.fixture('existing-db-warnings')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(
      `Use the --force flag to ignore these warnings like prisma db push --preview-feature --force`,
    )
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with --force', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      The database is already in sync with the Prisma schema.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should work with -f', async () => {
    ctx.fixture('reset')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from prisma/schema.prisma

      The database is already in sync with the Prisma schema.
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should block if old migrate is detected', async () => {
    ctx.fixture('old-migrate')
    const result = DbPush.new().parse(['--preview-feature', '--force'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            Using db push alongside migrate will interfere with migrations.
            The SQL in the README.md file of new migrations will not reflect the actual schema changes executed when running migrate up.
            Use the --ignore-migrations flag to ignore this message in an unnattended environment like prisma db push --preview-feature --ignore-migrations
          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from schema.prisma`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should continue if old migrate with --ignore-migrations', async () => {
    ctx.fixture('old-migrate')
    const result = DbPush.new().parse([
      '--preview-feature',
      '--force',
      '--ignore-migrations',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n'))
      .toMatchInlineSnapshot(`
      Prisma schema loaded from schema.prisma

      🚀  Your database is now in sync with your schema. Done in XXms
    `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('should fail if nativeTypes feature is enabled', async () => {
    ctx.fixture('nativeTypes-sqlite')
    const result = DbPush.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `"nativeTypes" preview feature is not supoorted yet. Remove it from your schema to use Prisma Migrate.`,
    )
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
