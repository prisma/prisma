import fs from 'fs'
import { join } from 'path'
import tempy from 'tempy'
import { Init, defaultSchema, defaultEnv } from '../Init'
import stripAnsi from 'strip-ansi'

describe('init', () => {
  test('is schema and env written on disk replace', async () => {
    const tmpDir = tempy.directory()
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const init = Init.new()
    const result = stripAnsi(await init.parse([]))

    expect(result).toMatchSnapshot()

    const schema = fs.readFileSync(join(tmpDir, 'schema.prisma'), 'utf-8')
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, '.env'), 'utf-8')
    expect(env).toMatch(defaultEnv())

    process.chdir(cwd)
  })

  test('works with url param', async () => {
    const tmpDir = tempy.directory()
    const cwd = process.cwd()
    process.chdir(tmpDir)

    const init = Init.new()
    const result = stripAnsi(
      await init.parse([
        '--url',
        process.env.TEST_POSTGRES_URI ||
          'postgres://prisma:prisma@localhost:5432/tests',
      ]),
    )
    expect(result).toMatchSnapshot()

    const schema = fs.readFileSync(join(tmpDir, 'schema.prisma'), 'utf-8')
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, '.env'), 'utf-8')
    expect(env).toMatch(
      defaultEnv(
        process.env.TEST_POSTGRES_URI ||
          'postgres://prisma:prisma@localhost:5432/tests',
      ),
    )

    process.chdir(cwd)
  })

  test('warns when DATABASE_URL present in .env ', async () => {
    const tmpDir = tempy.directory()
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    const cwd = process.cwd()
    process.chdir(tmpDir)
    fs.writeFileSync(
      join(tmpDir, '.env'),
      `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`,
    )
    const init = Init.new()
    const result = stripAnsi(
      await init.parse([
        '--url',
        process.env.TEST_POSTGRES_URI ||
          'postgres://prisma:prisma@localhost:5432/tests',
      ]),
    )
    expect(result).toMatchSnapshot()

    const schema = fs.readFileSync(join(tmpDir, 'schema.prisma'), 'utf-8')
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, '.env'), 'utf-8')
    expect(env).toMatch(
      `DATABASE_URL="postgres://dont:overwrite@me:5432/tests"`,
    )
    expect(stripAnsi(spy.mock.calls.join('\n'))).toMatchInlineSnapshot(
      `warn DATABASE_URL already exists in /tmp/dir/.env`,
    )
    spy.mockRestore()
    process.chdir(cwd)
  })
  test('appends when .env present', async () => {
    const tmpDir = tempy.directory()
    const cwd = process.cwd()
    process.chdir(tmpDir)
    fs.writeFileSync(join(tmpDir, '.env'), `SOMTHING="is here"`)
    const init = Init.new()
    const result = stripAnsi(
      await init.parse([
        '--url',
        process.env.TEST_POSTGRES_URI ||
          'postgres://prisma:prisma@localhost:5432/tests',
      ]),
    )
    expect(result).toMatchSnapshot()

    const schema = fs.readFileSync(join(tmpDir, 'schema.prisma'), 'utf-8')
    expect(schema).toMatch(defaultSchema())

    const env = fs.readFileSync(join(tmpDir, '.env'), 'utf-8')

    expect(env).toMatchSnapshot()

    process.chdir(cwd)
  })
})
