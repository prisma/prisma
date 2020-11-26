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
  const result = await ctx.cli(
    'init',
    '--url',
    process.env.TEST_POSTGRES_URI ||
      'postgres://prisma:prisma@localhost:5432/tests',
  )
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(
    defaultEnv(
      process.env.TEST_POSTGRES_URI ||
        'postgres://prisma:prisma@localhost:5432/tests',
    ),
  )
})

test('warns when DATABASE_URL present in .env ', async () => {
  fs.writeFileSync(
    join(ctx.tmpDir, '.env'),
    `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`,
  )
  const result = await ctx.cli(
    'init'
  )
  expect(stripAnsi(result.stdout)).toMatchSnapshot()
  expect(stripAnsi(result.stderr)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatch(`DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`)
  expect(
    stripAnsi(ctx.mocked['console.warn'].mock.calls.join('\n')),
  ).toMatchInlineSnapshot(``)
})
test('appends when .env present', async () => {
  fs.writeFileSync(join(ctx.tmpDir, '.env'), `SOMTHING="is here"`)
  const result = await ctx.cli(
    'init',
  )
  expect(stripAnsi(result.stdout)).toMatchSnapshot()

  const schema = fs.readFileSync(join(ctx.tmpDir, 'schema.prisma'), 'utf-8')
  expect(schema).toMatch(defaultSchema())

  const env = fs.readFileSync(join(ctx.tmpDir, '.env'), 'utf-8')
  expect(env).toMatchSnapshot()
})
