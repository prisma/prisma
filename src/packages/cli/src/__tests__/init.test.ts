import fs from 'fs'
import { join } from 'path'
import stripAnsi from 'strip-ansi'
import { defaultEnv, defaultSchema } from '../Init'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

test('is schema and env written on disk replace', async () => {
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(defaultEnv())
})

test('works with url param', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--url', 'file:dev.db')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('sqlite'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="file:dev.db"
`)
})

test('works with provider param - postgresql', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'postgresql')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('postgresql'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="postgresql://johndoe:randompassword@localhost:5432/mydb?schema=public"
`)
})

test('works with provider param - mysql', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'mysql')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('mysql'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="mysql://johndoe:randompassword@localhost:3306/mydb"
`)
})

test('works with provider param - SQLITE', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'SQLITE')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('sqlite'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="file:./dev.db"
`)
})

test('works with provider param - SqlServer', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'SqlServer')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('sqlserver'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="sqlserver://localhost:1433;database=mydb;user=SA;password=randompassword;"
`)
})

test('works with provider param - MongoDB', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--datasource-provider', 'MongoDB')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema('mongodb'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
# Environment variables declared in this file are automatically made available to Prisma.
# See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

# Prisma supports the native connection string format for PostgreSQL, MySQL, SQLite, SQL Server (Preview) and MongoDB (Preview).
# See the documentation for all the connection string options: https://pris.ly/d/connection-strings

DATABASE_URL="mongodb+srv://root:randompassword@cluster0.ab1cd.mongodb.net/mydb?retryWrites=true&w=majority"
`)
})

test('errors with invalid provider param', async () => {
  ctx.fixture('init')
  const result = ctx.cli('init', '--datasource-provider', 'INVALID')
  await expect(result).rejects.toThrowError()
})

test('warns when DATABASE_URL present in .env ', async () => {
  fs.writeFileSync(
    join(ctx.tmpDir, '.env'),
    `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`,
  )
  const result = await ctx.cli('init')
  expect(stripAnsi(result.all!)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(`DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`)
})

test('appends when .env present', async () => {
  fs.writeFileSync(join(ctx.tmpDir, '.env'), `SOMTHING="is here"`)
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(
    join(ctx.tmpDir, 'prisma', 'schema.prisma'),
    'utf-8',
  )
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchSnapshot()
})
