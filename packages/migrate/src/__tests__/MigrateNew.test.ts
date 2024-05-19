import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import fs from 'fs-jetpack'

import { MigrateNew } from '../commands/MigrateNew'
import { CaptureStdout } from '../utils/captureStdout'
import { setupMysql, tearDownMysql } from '../utils/setupMysql'
import type { SetupParams } from '../utils/setupPostgres'
import { setupPostgres, tearDownPostgres } from '../utils/setupPostgres'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const captureStdout = new CaptureStdout()

// Disable prompts
process.env.GITHUB_ACTIONS = '1'
// Disable generate
process.env.PRISMA_MIGRATE_SKIP_GENERATE = '1'

const originalEnv = { ...process.env }

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
  it('empty schema', async () => {
    ctx.fixture('schema-only-sqlite')
    const result = MigrateNew.new().parse(['--schema=./prisma/empty.prisma', '--name=first'])
    await expect(result).resolves.toMatchInlineSnapshot(`""`)

    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
    "Prisma schema loaded from prisma/empty.prisma
    Datasource "my_db": SQLite database "dev.db" at "file:dev.db"

    SQLite database dev.db created at file:dev.db


    The following migration have been created:

    20201231000000_first

    You can now edit it and apply it by running prisma migrate dev"
    `)
  })

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

describe('postgresql', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-new')

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

  beforeAll(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupPostgres(setupParams).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
    process.env.TEST_POSTGRES_SHADOWDB_URI_MIGRATE = connectionString.replace(
      'tests-migrate-new',
      'tests-migrate-new-shadowdb',
    )
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateNew.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-new", schema "public" at "localhost:5432"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-postgresql')

    const result = MigrateNew.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-new", schema "public" at "localhost:5432"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-postgresql')
    const result = MigrateNew.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Environment variables loaded from prisma/.env
      Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": PostgreSQL database "tests-migrate-new", schema "public" at "localhost:5432"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })
})

describe('mysql', () => {
  const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace('tests-migrate', 'tests-migrate-new')

  const setupParams: SetupParams = {
    connectionString,
    dirname: '',
  }

  beforeAll(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  beforeEach(async () => {
    await setupMysql(setupParams).catch((e) => {
      console.error(e)
    })
    // Back to original env vars
    process.env = { ...originalEnv }
    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MYSQL_URI_MIGRATE = connectionString
    process.env.TEST_MYSQL_SHADOWDB_URI_MIGRATE = connectionString.replace(
      'tests-migrate-new',
      'tests-migrate-new-shadowdb',
    )
  })

  afterEach(async () => {
    // Back to original env vars
    process.env = { ...originalEnv }
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  it('schema only', async () => {
    ctx.fixture('schema-only-mysql')

    const result = MigrateNew.new().parse([])
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-new" at "localhost:3306"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })

  it('schema only with shadowdb', async () => {
    ctx.fixture('schema-only-mysql')

    const result = MigrateNew.new().parse(['--schema=./prisma/shadowdb.prisma'])
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/shadowdb.prisma
      Datasource "my_db": MySQL database "tests-migrate-new" at "localhost:3306"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })

  it('create first migration', async () => {
    ctx.fixture('schema-only-mysql')
    const result = MigrateNew.new().parse([])

    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(captureStdout.getCapturedText().join('')).toMatchInlineSnapshot(`
      "Prisma schema loaded from prisma/schema.prisma
      Datasource "my_db": MySQL database "tests-migrate-new" at "localhost:3306"


      The following migration have been created:

      20201231000000_

      You can now edit it and apply it by running prisma migrate dev"
    `)
  })
})
