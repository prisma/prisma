import { DbPull } from '../commands/DbPull'
import { consoleContext, Context } from './__helpers__/context'
// import
//   SetupParams,
//   setupPostgres,
//   tearDownPostgres,
// } from '../utils/setupPostgres'

const ctx = Context.new().add(consoleContext()).assemble()

// test.only('basic introspection', async () => {
//   const mockExit = jest.spyOn(process, 'exit').mockImplementation()

//   let originalConnectionString =
//     process.env.TEST_POSTGRES_URI ||
//     'postgres://prisma:prisma@localhost:5432/tests'
//   originalConnectionString += '-introspection'

//   const SetupParams: SetupParams = {
//     connectionString: originalConnectionString,
//     dirname: path.join(__dirname, 'fixtures', 'introspection', 'postgresql'),
//   }

//   await setupPostgres(SetupParams).catch((e) => console.error(e))

//   ctx.fixture('introspection/postgresql')

//   const introspect = new DbPull()

//   try {
//     const result = await introspect.parse(['--print'])
//     console.debug({ result })
//     await expect(result).rejects.toThrowErrorMatchingInlineSnapshot()
//   } catch (e) {
//     introspect.
//     console.debug({ e })
//   }
//   await tearDownPostgres(SetupParams).catch((e) => {
//     console.log(e)
//   })

//   expect(
//     ctx.mocked['console.log'].mock.calls.join('\n'),
//   ).toMatchInlineSnapshot()
//   expect(mockExit).toHaveBeenCalledWith(1)
//   mockExit.mockRestore()
// })

test('basic introspection', async () => {
  ctx.fixture('introspection/sqlite')
  const introspect = new DbPull()
  await introspect.parse(['--print'])
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
})

test('introspection --force', async () => {
  ctx.fixture('introspection/sqlite')
  const introspect = new DbPull()
  await introspect.parse(['--print', '--force'])
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
})

test('basic introspection with --url', async () => {
  ctx.fixture('introspection/sqlite')
  const introspect = new DbPull()
  await introspect.parse(['--print', '--url', 'file:dev.db'])
  expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchSnapshot()
})

it('should succeed when schema and db do match', async () => {
  ctx.fixture('introspect/prisma')
  const result = DbPull.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`
    Prisma schema loaded from schema.prisma

    Introspecting based on datasource defined in schema.prisma …

    ✔ Introspected 3 models and wrote them into schema.prisma in XXms
          
    Run prisma generate to generate Prisma Client.

  `)
})

it('should succeed when schema and db do match using --url', async () => {
  ctx.fixture('introspect/prisma')
  const result = DbPull.new().parse(['--url=file:./dev.db'])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`
    Prisma schema loaded from schema.prisma

    Introspecting …

    ✔ Introspected 3 models and wrote them into schema.prisma in XXms
          
    Run prisma generate to generate Prisma Client.

  `)
})

it('should succeed and keep changes to valid schema and output warnings', async () => {
  ctx.fixture('introspect')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = DbPull.new().parse([
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`
    Prisma schema loaded from prisma/reintrospection.prisma

    Introspecting based on datasource defined in prisma/reintrospection.prisma …

    ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in in XXms
          
    *** WARNING ***

    These models were enriched with \`@@map\` information taken from the previous Prisma schema.
    - Model "AwesomeNewPost"
    - Model "AwesomeProfile"
    - Model "AwesomeUser"

    Run prisma generate to generate Prisma Client.
  `)

  expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(
    ``,
  )

  expect(ctx.fs.read('prisma/reintrospection.prisma')).toMatchInlineSnapshot(`
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/client"
    }

    datasource db {
      provider = "sqlite"
      url      = "file:dev.db"
    }

    model AwesomeUser {
      email    String           @unique
      id       Int              @id @default(autoincrement())
      name     String?
      newPosts AwesomeNewPost[]
      profile  AwesomeProfile?

      @@map("User")
    }

    model AwesomeNewPost {
      authorId  Int
      content   String?
      createdAt DateTime    @default(now())
      id        Int         @id @default(autoincrement())
      published Boolean     @default(false)
      title     String
      author    AwesomeUser @relation(fields: [authorId], references: [id])

      @@map("Post")
    }

    model AwesomeProfile {
      bio    String?
      id     Int         @id @default(autoincrement())
      userId Int         @unique
      user   AwesomeUser @relation(fields: [userId], references: [id])

      @@map("Profile")
    }

  `)
})

it('should succeed and keep changes to valid schema and output warnings when using --print', async () => {
  ctx.fixture('introspect')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = DbPull.new().parse([
    '--print',
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchSnapshot()

  expect(ctx.mocked['console.error'].mock.calls.join('\n'))
    .toMatchInlineSnapshot(`

                                                                            *** WARNING ***

                                                                            These models were enriched with \`@@map\` information taken from the previous Prisma schema.
                                                                            - Model "AwesomeNewPost"
                                                                            - Model "AwesomeProfile"
                                                                            - Model "AwesomeUser"

                                      `)

  expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(
    originalSchema,
  )
})

it('should succeed when schema and db do not match', async () => {
  ctx.fixture('existing-db-histories-diverge')
  const result = DbPull.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`
    Prisma schema loaded from prisma/schema.prisma

    Introspecting based on datasource defined in prisma/schema.prisma …

    ✔ Introspected 3 models and wrote them into prisma/schema.prisma in in XXms
          
    Run prisma generate to generate Prisma Client.
  `)
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-only-sqlite')
  const result = DbPull.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

          P4001 The introspected database was empty: 

          prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

          To fix this, you have two options:

          - manually create a table in your database (using SQL).
          - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

          Then you can run prisma db pull again. 

        `)
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-only-sqlite')
  ctx.fs.write('prisma/dev.db', '')
  const result = DbPull.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

          P4001 The introspected database was empty: 

          prisma db pull could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the prisma generate command.

          To fix this, you have two options:

          - manually create a table in your database (using SQL).
          - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

          Then you can run prisma db pull again. 

        `)
})

it('should fail when Prisma schema is missing', async () => {
  const result = DbPull.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          Could not find a schema.prisma file that is required for this command.
          You can either provide it with --schema, set it as \`prisma.schema\` in your package.json or put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
        `)
})

it('should fail when schema is invalid', async () => {
  ctx.fixture('introspect')
  const result = DbPull.new().parse(['--schema=./prisma/invalid.prisma'])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P1012 Introspection failed as your current Prisma schema file is invalid

          Please fix your current schema manually, use prisma validate to confirm it is valid and then run this command again.
          Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.

        `)
})

it('should succeed when schema is invalid and using --force', async () => {
  ctx.fixture('introspect')

  const result = DbPull.new().parse([
    '--schema=./prisma/invalid.prisma',
    '--force',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`
    Prisma schema loaded from prisma/invalid.prisma

    Introspecting based on datasource defined in prisma/invalid.prisma …

    ✔ Introspected 3 models and wrote them into prisma/invalid.prisma in in XXms
          
    Run prisma generate to generate Prisma Client.
  `)

  expect(ctx.fs.read('prisma/invalid.prisma')).toMatchSnapshot()
})
