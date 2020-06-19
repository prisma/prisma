import { join } from 'path'
import { promisify } from 'util'
import fs from 'fs'
import rimraf from 'rimraf'
import { Init, defaultSchema, defaultEnv } from '../commands/Init'
import stripAnsi from 'strip-ansi'

const del = promisify(rimraf)
const tmp = join(__dirname, '../../prisma')

beforeEach(async () => {
  await del(tmp)
})

afterAll(async () => {
  await del(tmp)
})

describe('init', () => {
  test('is schema and env written on disk replace', async () => {
    const init = Init.new()
    const result = stripAnsi(await init.parse([]))

    const schema = fs.readFileSync(join(tmp, 'schema.prisma'), 'utf-8')
    const env = fs.readFileSync(join(tmp, '.env'), 'utf-8')

    expect(schema).toMatch(defaultSchema())
    expect(env).toMatch(defaultEnv())
    expect(result).toMatchInlineSnapshot(`
      "
      ✔ Your Prisma schema was created at prisma/schema.prisma.
        You can now open it in your favorite editor.

      Next steps:
      1. Set the DATABASE_URL in the .env file to point to your existing database. If your database has no tables yet, read https://pris.ly/d/getting-started.
      2. Set the provider of the datasource block in schema.prisma to match your database: postgresql, mysql or sqlite.
      3. Run prisma introspect to turn your database schema into a Prisma data model.
      4. Run prisma generate to install Prisma Client. You can then start querying your database.

      More information in our documentation:
      https://pris.ly/d/getting-started
          "
    `)
  })

  test('works with url param', async () => {
    const init = Init.new()
    const result = stripAnsi(
      await init.parse(['--url', process.env.TEST_POSTGRES_URI!]),
    )

    const schema = fs.readFileSync(join(tmp, 'schema.prisma'), 'utf-8')
    const env = fs.readFileSync(join(tmp, '.env'), 'utf-8')

    expect(schema).toMatch(defaultSchema())
    expect(env).toMatch(defaultEnv(process.env.TEST_POSTGRES_URI!))
    expect(result).toMatchInlineSnapshot(`
      "
      ✔ Your Prisma schema was created at prisma/schema.prisma.
        You can now open it in your favorite editor.

      Next steps:
      1. Run prisma introspect to turn your database schema into a Prisma data model.
      2. Run prisma generate to install Prisma Client. You can then start querying your database.

      More information in our documentation:
      https://pris.ly/d/getting-started
          "
    `)
  })
})
