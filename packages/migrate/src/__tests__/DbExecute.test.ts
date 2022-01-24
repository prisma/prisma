import { DbExecute } from '../commands/DbExecute'
import { jestConsoleContext, jestContext } from '@prisma/sdk'
import fs from 'fs'
// import { setupMysql, tearDownMysql } from '../utils/setupMysql'
// import { setupMSSQL, tearDownMSSQL } from '../utils/setupMSSQL'
// import { SetupParams, setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

// beforeAll(async () => {
//   process.env.TEST_POSTGRES_DEFAULT_DB = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'postgres')
// })

describe('db execute', () => {
  it('--preview-feature flag is required', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `This command is in Preview. Use the --preview-feature flag to use it like prisma db execute --preview-feature`,
    )
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should fail if missing --file and --stdin', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            Either --stdin or --file must be provided.
            See \`prisma db execute -h\`
          `)
  })

  it('should fail if both --file and --stdin are provided', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--file=1', '--stdin'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            --stdin and --file cannot be used at the same time. Only 1 must be provided. 
            See \`prisma db execute -h\`
          `)
  })

  it('should fail if missing --schema and --url', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--stdin'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `--stdin was passed but the input was empty. See \`prisma db execute -h\``,
    )
  })

  it('should fail if both --schema and --url are provided', async () => {
    ctx.fixture('empty')

    const result = DbExecute.new().parse(['--preview-feature', '--stdin', '--schema=1', '--url=1'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            --url and --schema cannot be used at the same time. Only 1 must be provided.
            See \`prisma db execute -h\`
          `)
  })

  // TODO, it's passing?
  it('should fail with --file --url=file:doesnotexists.db', async () => {
    ctx.fixture('introspection/sqlite')

    fs.writeFileSync('script.sql', 'SELECT 1')
    const result = DbExecute.new().parse(['--preview-feature', '--url=file:doesnotexists.db', '--file=./script.sql'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
  })

  it('should pass with --file --url=file:dev.db', async () => {
    ctx.fixture('introspection/sqlite')

    fs.writeFileSync('script.sql', 'SELECT 1')
    const result = DbExecute.new().parse(['--preview-feature', '--url=file:dev.db', '--file=./script.sql'])
    await expect(result).resolves.toMatchInlineSnapshot(``)
  })

  // it('should pass with --file  --schema mysql', async () => {
  //   // ctx.fixture('schema-only-mysql')
  //   ctx.fixture('introspection/mysql')

  //   fs.writeFileSync('script.sql', 'SELECT 1')
  //   const result = DbExecute.new().parse(['--preview-feature', '--schema=./schema.prisma', '--file=./script.sql'])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  // })

  // it('should pass with --file  --url postgresql', async () => {
  //   // ctx.fixture('schema-only-postgresql')
  //   ctx.fixture('introspection/postgresql')

  //   fs.writeFileSync('script.sql', 'SELECT 1')
  //   const result = DbExecute.new().parse([
  //     '--preview-feature',
  //     '--url',
  //     process.env.TEST_POSTGRES_DEFAULT_DB!,
  //     '--file=./script.sql',
  //   ])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  // })

  // it('should pass with --file  --schema postgresql', async () => {
  //   ctx.fixture('schema-only-postgresql')

  //   fs.writeFileSync('script.sql', 'SELECT 1')
  //   const result = DbExecute.new().parse([
  //     '--preview-feature',
  //     '--schema=./prisma/schema.prisma',
  //     '--file=./script.sql',
  //   ])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  // })

  // it('should pass with --file  --schema sqlserver', async () => {
  //   ctx.fixture('schema-only-sqlserver')

  //   fs.writeFileSync('script.sql', 'SELECT 1')
  //   const result = DbExecute.new().parse([
  //     '--preview-feature',
  //     '--schema=./prisma/schema.prisma',
  //     '--file=./script.sql',
  //   ])
  //   await expect(result).resolves.toMatchInlineSnapshot(``)
  // })
})
