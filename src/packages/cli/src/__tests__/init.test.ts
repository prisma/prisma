import fs from 'fs'
import { join } from 'path'
import stripAnsi from 'strip-ansi'
import { defaultEnv, defaultSchema } from '../Init'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

test('is schema and env written on disk replace', async () => {
  const result = await ctx.cli('init')

  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(defaultEnv())
})

test('works with url param', async () => {
  ctx.fixture('init')
  const result = await ctx.cli('init', '--url', 'file:dev.db')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema('sqlite'))

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchInlineSnapshot(`
    # Environment variables declared in this file are automatically made available to Prisma.
    # See the documentation for more detail: https://pris.ly/d/prisma-schema#using-environment-variables

    # Prisma supports the native connection string format for PostgreSQL, MySQL and SQLite.
    # See the documentation for all the connection string options: https://pris.ly/d/connection-strings

    DATABASE_URL="file:dev.db"
  `)
})

test('warns when DATABASE_URL present in .env ', async () => {
  fs.writeFileSync(
    join(ctx.tmpDir, '.env'),
    `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`,
  )
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()
  // For Console Warn
  expect(stripAnsi(result.stderr)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(`DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`)
})
test('appends when .env present', async () => {
  fs.writeFileSync(join(ctx.tmpDir, '.env'), `SOMTHING="is here"`)
  const result = await ctx.cli('init')
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchSnapshot()
})
