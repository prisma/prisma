import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs'
import { join } from 'path'
import stripAnsi from 'strip-ansi'

import { defaultEnv, defaultGitIgnore, defaultSchema } from '../../Init'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

test('is schema and env written on disk replace', async () => {
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(defaultEnv())
})

test('works with url param', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--url', 'file:dev.db')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('sqlite'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="file:dev.db"
  `)
})

test('works with provider param - postgresql', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'postgresql')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('postgresql'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
  `)
})

test('works with provider param - cockroachdb', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'cockroachdb')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('cockroachdb'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="postgresql://johndoe:randompassword@localhost:26257/mydb?schema=public"
  `)
})

test('works with provider and url params - cockroachdb', async () => {
  ctx.fixture('init')
  const result = await ctx.cli(
    'init',
    '--datasource-provider',
    'cockroachdb',
    '--url',
    'postgres://prisma@localhost:26257/defaultdb',
  )
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('cockroachdb'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="postgresql://johndoe:randompassword@localhost:26257/mydb?schema=public"
  `)
})

test('works with provider param - mysql', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'mysql')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('mysql'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="mysql://johndoe:randompassword@localhost:3306/mydb"
  `)
})

test('works with provider param - SQLITE', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'SQLITE')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('sqlite'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="file:./dev.db"
  `)
})

test('works with provider param - SqlServer', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'SqlServer')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('sqlserver'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="sqlserver://localhost:1433;database=mydb;user=SA;password=randompassword;"
  `)
})

test('works with provider param - MongoDB', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'MongoDB')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('mongodb'))
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#accessing-environment-variables-from-the-schema

    # Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server, MongoDB and CockroachDB.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="mongodb+srv://root:randompassword@cluster0.ab1cd.mongodb.net/mydb?retryWrites=true&w=majority"
  `)
})

test('errors with invalid provider param', async () => {
  ctx.fixture('init')
  const result = ctx.cli('init', '--datasource-provider', 'INVALID')
  await expect(result).rejects.toThrow()
})

test('warns when DATABASE_URL present in .env ', async () => {
  fs.writeFileSync(join(ctx.tmpDir, '.env'), `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`)
  const result = await ctx.cli('init')
  expect(stripAnsi(result.all!)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(`DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`)
})

test('appends when .env present', async () => {
  fs.writeFileSync(join(ctx.tmpDir, '.env'), `SOMETHING="is here"`)
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'prisma', 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())
  expect(schema).toMatchSnapshot()

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchSnapshot()
})

test('writes a minimal .gitignore file', async () => {
  ctx.fixture('init')
  await ctx.cli('init')
  const gitignore = fs.readFileSync(join(ctx.tmpDir, '.gitignore'), 'utf-8')
  expect(gitignore).toMatch(defaultGitIgnore())

  expect(gitignore).toMatchSnapshot()
})

test('ignore .gitignore file if already present (do not override)', async () => {
  ctx.fixture('init')
  const gitignorePath = join(ctx.tmpDir, '.gitignore')
  fs.writeFileSync(gitignorePath, `# This should not be overridden`)
  const gitignoreBefore = fs.readFileSync(gitignorePath, 'utf-8')
  await ctx.cli('init')
  const gitignoreAfter = fs.readFileSync(gitignorePath, 'utf-8')
  expect(gitignoreAfter).toEqual(gitignoreBefore)
})
