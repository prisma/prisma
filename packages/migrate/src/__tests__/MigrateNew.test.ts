import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs-jetpack'

import { MigrateNew } from '../commands/MigrateNew'
import { CaptureStdout } from '../utils/captureStdout'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const captureStdout = new CaptureStdout()

// Disable prompts
process.env.GITHUB_ACTIONS = '1'
// Disable generate
process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

beforeEach(() => {
  captureStdout.startCapture()
})

afterEach(() => {
  captureStdout.clearCaptureText()
})

afterAll(() => {
  captureStdout.stopCapture()
})

describe('common', () => {
  it('invalid schema', async () => {
    ctx.fixture('schema-only-sqlite')

    try {
      await MigrateNew.new().parse(['--schema=./prisma/invalid.prisma'])
      expect(true).toBe(false) // unreachable
    } catch (error) {
      expect(error.message).toMatchInlineSnapshot(`
        "Prisma schema validation - (get-config wasm)
        Error code: P1012
        error: Error validating: This line is invalid. It does not start with any known Prisma schema keyword.
          -->  prisma/invalid.prisma:10
           | 
         9 | }
        10 | model Blog {
        11 | 
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0"
      `)
    }

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/invalid.prisma
      "
    `)
  })

  it('provider array should fail', async () => {
    ctx.fixture('schema-only-sqlite')

    try {
      await MigrateNew.new().parse(['--schema=./prisma/provider-array.prisma'])
      expect(true).toBe(false) // unreachable
    } catch (error) {
      expect(error.message).toMatchInlineSnapshot(`
        "Prisma schema validation - (get-config wasm)
        Error code: P1012
        error: Error validating datasource \`my_db\`: The provider argument in a datasource must be a string literal
          -->  prisma/provider-array.prisma:2
           | 
         1 | datasource my_db {
         2 |     provider = ["postgresql", "sqlite"]
           | 

        Validation Error Count: 1
        [Context: getConfig]

        Prisma CLI Version : 0.0.0"
      `)
    }
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/provider-array.prisma
      "
    `)
  })

  it('wrong flag', async () => {
    const commandInstance = MigrateNew.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--something'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('help flag', async () => {
    const commandInstance = MigrateNew.new()
    const spy = jest.spyOn(commandInstance, 'help').mockImplementation(() => 'Help Me')

    await commandInstance.parse(['--help'])
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('should fail if no schema file', async () => {
    ctx.fixture('empty')
    const result = MigrateNew.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "Could not find a schema.prisma file that is required for this command.
      You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location"
    `)
  })
})

describe('sqlite', () => {
  it('first migration (--name)', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateNew.new().parse(['--name=first'])

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(fs.exists('prisma/migrations/migration_lock.toml')).toEqual('file')

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

      SQLite database dev.db created at file:dev.db


      The following migration have been created:

      20201231000000_first

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })
})
