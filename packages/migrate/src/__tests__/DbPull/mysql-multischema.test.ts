import path from 'path'

import { DbPull } from '../../commands/DbPull'
import { setupMysql, SetupParams, tearDownMysql } from '../../utils/setupMysql'
import { describeMatrix, mysqlOnly } from '../__helpers__/conditionalTests'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

describeMatrix(mysqlOnly, 'mysql-multischema', () => {
  const connectionString = process.env.TEST_MYSQL_URI_MIGRATE!.replace(
    'tests-migrate',
    'tests-migrate-db-pull-multischema-mysql',
  )

  const setupParams: SetupParams = {
    connectionString,
    // Note: at this location there is a setup.sql file
    // which will be executed a SQL file so the database is not empty
    dirname: path.join(__dirname, '..', '..', '__tests__', 'fixtures', 'introspection', 'mysql-multischema'),
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

    // Update env var because it's the one that is used in the schemas tested
    process.env.TEST_MYSQL_URI_MIGRATE = connectionString
  })

  afterEach(async () => {
    await tearDownMysql(setupParams).catch((e) => {
      console.error(e)
    })
  })

  test('without datasource property `schemas` it should error with P4001, empty database', async () => {
    ctx.fixture('introspection/mysql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(['--print', '--schema', 'without-schemas-in-datasource.prisma'], await ctx.config())
    await expect(result).rejects.toThrow(`P4001`)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=[]` should error with P1012, array can not be empty', async () => {
    ctx.fixture('introspection/mysql-multischema')
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
       3 |   url      = env("TEST_MYSQL_URI_MIGRATE")
       4 |   schemas  = []
         | 

      Validation Error Count: 1
      [Context: getConfig]

      Prisma CLI Version : 0.0.0"
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=["base", "transactional"]` should succeed', async () => {
    ctx.fixture('introspection/mysql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-2-values.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = env("TEST_MYSQL_URI_MIGRATE")
        schemas  = ["base", "transactional"]
      }

      model base_some_table {
        id         Int                        @id
        email      String                     @db.Text
        some_table transactional_some_table[]

        @@map("some_table")
        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text
        post  post[]

        @@schema("base")
      }

      model post {
        id       Int         @id
        title    String      @db.Text
        authorId Int
        status   post_status
        user     user        @relation(fields: [authorId], references: [id])

        @@index([authorId], map: "post_authorId_fkey")
        @@schema("transactional")
      }

      model transactional_some_table {
        id         Int               @id
        title      String            @db.Text
        authorId   Int
        status     some_table_status
        some_table base_some_table   @relation(fields: [authorId], references: [id], map: "post_authorId_fkey2")

        @@index([authorId], map: "post_authorId_fkey2")
        @@map("some_table")
        @@schema("transactional")
      }

      enum post_status {
        ON
        OFF

        @@schema("transactional")
      }

      enum some_table_status {
        ON
        OFF

        @@schema("transactional")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma schema:
      //   - Type: "model", name: "base_some_table"
      //   - Type: "model", name: "transactional_some_table"
      // "
    `)
  })

  test('datasource property `schemas=["base"]` should succeed', async () => {
    ctx.fixture('introspection/mysql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-1-value.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = env("TEST_MYSQL_URI_MIGRATE")
        schemas  = ["base"]
      }

      model some_table {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('datasource property `schemas=["does-not-exist"]` should error with P4001, empty database', async () => {
    ctx.fixture('introspection/mysql-multischema')
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
    ctx.fixture('introspection/mysql-multischema')
    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--schema', 'with-schemas-in-datasource-1-existing-1-non-existing-value.prisma'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = env("TEST_MYSQL_URI_MIGRATE")
        schemas  = ["base", "does-not-exist"]
      }

      model some_table {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with --schemas=base without preview feature should error', async () => {
    ctx.fixture('introspection/mysql-multischema')
    ctx.fs.remove(`./schema.prisma`)

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base'],
      await ctx.config(),
    )
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
      "The preview feature \`multiSchema\` must be enabled before using --schemas command line parameter.

      "
    `)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "
      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url with --schemas=does-not-exist should error', async () => {
    ctx.fixture('introspection/mysql-multischema')

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
    ctx.fixture('introspection/mysql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = "mysql://root:root@localhost:3306/tests-migrate-db-pull-multischema-mysql"
        schemas  = ["base"]
      }

      model some_table {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('--url  --schemas=base,transactional (2 existing schemas) should succeed', async () => {
    ctx.fixture('introspection/mysql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base,transactional'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = "mysql://root:root@localhost:3306/tests-migrate-db-pull-multischema-mysql"
        schemas  = ["base", "transactional"]
      }

      model base_some_table {
        id         Int                        @id
        email      String                     @db.Text
        some_table transactional_some_table[]

        @@map("some_table")
        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text
        post  post[]

        @@schema("base")
      }

      model post {
        id       Int         @id
        title    String      @db.Text
        authorId Int
        status   post_status
        user     user        @relation(fields: [authorId], references: [id])

        @@index([authorId], map: "post_authorId_fkey")
        @@schema("transactional")
      }

      model transactional_some_table {
        id         Int               @id
        title      String            @db.Text
        authorId   Int
        status     some_table_status
        some_table base_some_table   @relation(fields: [authorId], references: [id], map: "post_authorId_fkey2")

        @@index([authorId], map: "post_authorId_fkey2")
        @@map("some_table")
        @@schema("transactional")
      }

      enum post_status {
        ON
        OFF

        @@schema("transactional")
      }

      enum some_table_status {
        ON
        OFF

        @@schema("transactional")
      }

      "
    `)

    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      // *** WARNING ***
      // 
      // These items were renamed due to their names being duplicates in the Prisma schema:
      //   - Type: "model", name: "base_some_table"
      //   - Type: "model", name: "transactional_some_table"
      // "
    `)
  })

  test('--url  --schemas=base,does-not-exist (1 existing schemas + 1 non-existing) should succeed', async () => {
    ctx.fixture('introspection/mysql-multischema')

    const introspect = new DbPull()
    const result = introspect.parse(
      ['--print', '--url', setupParams.connectionString, '--schemas', 'base,does-not-exist'],
      await ctx.config(),
    )
    await expect(result).resolves.toMatchInlineSnapshot(`""`)
    expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
      "generator client {
        provider        = "prisma-client-js"
        previewFeatures = ["multiSchema"]
      }

      datasource db {
        provider = "mysql"
        url      = "mysql://root:root@localhost:3306/tests-migrate-db-pull-multischema-mysql"
        schemas  = ["base", "does-not-exist"]
      }

      model some_table {
        id    Int    @id
        email String @db.Text

        @@schema("base")
      }

      model user {
        id    Int    @id
        email String @db.Text

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
})
