import fs from 'fs'
import { join } from 'path'
import tempy from 'tempy'
import { Init, defaultSchema, defaultEnv } from '../commands/Init'
import stripAnsi from 'strip-ansi'

describe('init', () => {
  test('is schema and env written on disk replace', async () => {
    const tmpDir = tempy.directory()
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const init = Init.new()
    const result = stripAnsi(await init.parse([]))

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

    const schema = fs.readFileSync(
      join(tmpDir, 'prisma', 'schema.prisma'),
      'utf-8',
    )
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, 'prisma', '.env'), 'utf-8')
    expect(env).toMatch(defaultEnv())

    process.chdir(cwd)
  })

  test('works with url param', async () => {
    const tmpDir = tempy.directory()
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const init = Init.new()
    const result = stripAnsi(
      await init.parse(['--url', process.env.TEST_POSTGRES_URI!]),
    )
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

    const schema = fs.readFileSync(
      join(tmpDir, 'prisma', 'schema.prisma'),
      'utf-8',
    )
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, 'prisma', '.env'), 'utf-8')
    expect(env).toMatch(defaultEnv(process.env.TEST_POSTGRES_URI!))

    process.chdir(cwd)
  })
})
