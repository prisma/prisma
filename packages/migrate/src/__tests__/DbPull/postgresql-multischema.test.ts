import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { SetupParams, setupPostgres, tearDownPostgres } from '../../utils/setupPostgres'
import { describeMatrix, postgresOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

describeMatrix(postgresOnly, 'postgresql-multischema', () => {
  const connectionString = process.env.TEST_POSTGRES_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-multischema-postgresql',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'postgresql-multischema'),
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

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_POSTGRES_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    await tearDownPostgres(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'without-schemas-in-datasource.prisma'], await ctx.config())
    await expect(result).rejects.toThrow(`P4001`)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=[]` should error with P1012, array can not be empty', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-0-value.prisma'],
      await ctx.config(),
    )
    await expect(result).rejects.toMatchInlineSnapshot(`
      "Prisma schema validation - (get-config wasm)
      Error code: P1012
      error: If provided, the schemas array can not be empty.
        -->  with-schemas-in-datasource-0-value.prisma:4
         | 
       3 |   url      = env("TEST_POSTGRES_URI_MIGRATE")
       4 |   schemas  = []
         | 

      Validation Error Count: 1
      [Context: getConfig]

      Prisma CLI Version : 0.0.0"
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgres"
        url      = env("TEST_POSTGRES_URI_MIGRATE")
        schemas  = ["base", "transactional"]
      }

      model User {
        id    String @id
        email String
        Post  Post[]

        @@schema("base")
      }

      model base_some_table {
        id         String                     @id(map: "User_pkey2")
        email      String
        some_table transactional_some_table[]

        @@map("some_table")
        @@schema("base")
      }

      model Post {
        id       String @id
        title    String
        authorId String
        User     User   @relation(fields: [authorId], references: [id])

        @@schema("transactional")
      }

      model transactional_some_table {
        id         String          @id(map: "Post_pkey2")
        title      String
        authorId   String
        some_table base_some_table @relation(fields: [authorId], references: [id], map: "Post_authorId_fkey2")

        @@map("some_table")
        @@schema("transactional")
      }

      enum base_status {
        ON
        OFF

        @@map("status")
        @@schema("base")
      }

      enum transactional_status {
        ON
        OFF

        @@map("status")
        @@schema("transactional")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma schema:
      //   - Type: "enum", name: "base_status"
      //   - Type: "enum", name: "transactional_status"
      //   - Type: "model", name: "base_some_table"
      //   - Type: "model", name: "transactional_some_table"
      // "
    `)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgres"
        url      = env("TEST_POSTGRES_URI_MIGRATE")
        schemas  = ["base"]
      }

      model User {
        id    String @id
        email String

        @@schema("base")
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String

        @@schema("base")
      }

      enum status {
        ON
        OFF

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-1-non-existing-value.prisma'],
      await ctx.config(),
    )
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=["does-not-exist", "base"]` should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgres"
        url      = env("TEST_POSTGRES_URI_MIGRATE")
        schemas  = ["base", "does-not-exist"]
      }

      model User {
        id    String @id
        email String

        @@schema("base")
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String

        @@schema("base")
      }

      enum status {
        ON
        OFF

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with --schemas=does-not-exist should error', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'does-not-exist'],
      await ctx.config(),
    )
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "
      P4001 The introspected database was empty:

      prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

      To fix this, you have two options:

      - manually create a table in your database.
      - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

      Then you can run prisma db pull again. 
      "
    `)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url --schemas=base (1 existing schema) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = "postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql"
        schemas  = ["base"]
      }

      model User {
        id    String @id
        email String

        @@schema("base")
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String

        @@schema("base")
      }

      enum status {
        ON
        OFF

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url  --schemas=base,transactional (2 existing schemas) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base,transactional'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = "postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql"
        schemas  = ["base", "transactional"]
      }

      model User {
        id    String @id
        email String
        Post  Post[]

        @@schema("base")
      }

      model base_some_table {
        id         String                     @id(map: "User_pkey2")
        email      String
        some_table transactional_some_table[]

        @@map("some_table")
        @@schema("base")
      }

      model Post {
        id       String @id
        title    String
        authorId String
        User     User   @relation(fields: [authorId], references: [id])

        @@schema("transactional")
      }

      model transactional_some_table {
        id         String          @id(map: "Post_pkey2")
        title      String
        authorId   String
        some_table base_some_table @relation(fields: [authorId], references: [id], map: "Post_authorId_fkey2")

        @@map("some_table")
        @@schema("transactional")
      }

      enum base_status {
        ON
        OFF

        @@map("status")
        @@schema("base")
      }

      enum transactional_status {
        ON
        OFF

        @@map("status")
        @@schema("transactional")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma schema:
      //   - Type: "enum", name: "base_status"
      //   - Type: "enum", name: "transactional_status"
      //   - Type: "model", name: "base_some_table"
      //   - Type: "model", name: "transactional_some_table"
      // "
    `)
  })

  test('--url  --schemas=base,does-not-exist (1 existing schemas + 1 non-existing) should succeed', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base,does-not-exist'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = "postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql"
        schemas  = ["base", "does-not-exist"]
      }

      model User {
        id    String @id
        email String

        @@schema("base")
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String

        @@schema("base")
      }

      enum status {
        ON
        OFF

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with --schemas=["does-not-exist", "base"] should error', async () => {
    ctx.fixture('introspection/postgresql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "postgresql"
        url      = "postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql"
        schemas  = ["base"]
      }

      model User {
        id    String @id
        email String

        @@schema("base")
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String

        @@schema("base")
      }

      enum status {
        ON
        OFF

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with `?schema=does-not-exist` should error with with P4001, empty database', async () => {
    const introspect = new DbPull()
    const connectionString = `${setupParams.connectionString}?schema=does-not-exist`
    const result = introspect.parse(['--print', '--url', connectionString], await ctx.config())
    await expect(result).rejects.toThrow(`P4001`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`""`)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with `?schema=base` should succeed', async () => {
    const introspect = new DbPull()
    const connectionString = `${setupParams.connectionString}?schema=base`
    const result = introspect.parse(['--print', '--url', connectionString], await ctx.config())
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "datasource db {
        provider = "postgresql"
        url      = "postgres://prisma:prisma@localhost:5432/tests-migrate-db-pull-multischema-postgresql?schema=base"
      }

      model User {
        id    String @id
        email String
      }

      model some_table {
        id    String @id(map: "User_pkey2")
        email String
      }

      enum status {
        ON
        OFF
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
