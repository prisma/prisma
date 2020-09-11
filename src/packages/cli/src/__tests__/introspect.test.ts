import { Introspect } from '@prisma/introspection'
import { Context } from './__helpers__/context'

const ctx = Context.new<{
  mocked: {
    'console.log': jest.SpyInstance
    'console.error': jest.SpyInstance
  }
}>()

beforeEach(() => {
  ctx.mocked['console.log'] = jest
    .spyOn(console, 'log')
    .mockImplementation(() => {})

  ctx.mocked['console.error'] = jest
    .spyOn(console, 'error')
    .mockImplementation(() => {})
})

afterEach(() => {
  ctx.mocked['console.log'].mockRestore()
  ctx.mocked['console.error'].mockRestore()
})

it('should succeed when schema and db do match', async () => {
  ctx.fixture('example-project/prisma')
  const result = Introspect.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`

                            Introspecting based on datasource defined in schema.prisma …

                            ✔ Introspected 3 models and wrote them into schema.prisma in XXms
                                  
                            Run yarn prisma generate to generate Prisma Client.

              `)
})

it('should succeed when schema and db do match using --url', async () => {
  ctx.fixture('example-project/prisma')
  const result = Introspect.new().parse(['--url=file:./dev.db'])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  console.log(ctx.mocked['console.log'].mock.calls)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'XXms'),
  ).toMatchInlineSnapshot(`

    Introspecting …

    ✔ Introspected 3 models and wrote them into schema.prisma in XXms
          
    Run yarn prisma generate to generate Prisma Client.

  `)
})

it('should succeed and keep changes to valid schema and output warnings', async () => {
  ctx.fixture('introspect-force')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = Introspect.new().parse([
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

                    Introspecting based on datasource defined in prisma/reintrospection.prisma …

                    ✔ Introspected 3 models and wrote them into prisma/reintrospection.prisma in in XXms
                          
                    *** WARNING ***

                    These models were enriched with \`@@map\` information taken from the previous Prisma schema.
                    - Model "AwesomeNewPost"
                    - Model "AwesomeProfile"
                    - Model "AwesomeUser"

                    Run yarn prisma generate to generate Prisma Client.
          `)

  expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(
    ``,
  )

  expect(ctx.fs.read('prisma/reintrospection.prisma')).toStrictEqual(
    originalSchema,
  )
})

it('should succeed and keep changes to valid schema and output warnings when using --print', async () => {
  ctx.fixture('introspect-force')
  const originalSchema = ctx.fs.read('prisma/reintrospection.prisma')
  const result = Introspect.new().parse([
    '--print',
    '--schema=./prisma/reintrospection.prisma',
  ])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`
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
      id       Int              @default(autoincrement()) @id
      name     String?
      newPosts AwesomeNewPost[]
      profile  AwesomeProfile?

      @@map("User")
    }

    model AwesomeNewPost {
      authorId  Int
      content   String?
      createdAt DateTime    @default(now())
      id        Int         @default(autoincrement()) @id
      published Boolean     @default(false)
      title     String
      author    AwesomeUser @relation(fields: [authorId], references: [id])

      @@map("Post")
    }

    model AwesomeProfile {
      bio    String?
      id     Int         @default(autoincrement()) @id
      userId Int         @unique
      user   AwesomeUser @relation(fields: [userId], references: [id])

      @@map("Profile")
    }


    // introspectionSchemaVersion: NonPrisma,
  `)

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
  ctx.fixture('schema-db-out-of-sync')
  const result = Introspect.new().parse([])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

                        Introspecting based on datasource defined in schema.prisma …

                        ✔ Introspected 3 models and wrote them into schema.prisma in in XXms
                              
                        Run yarn prisma generate to generate Prisma Client.
            `)
})

it('should fail when db is missing', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.remove('dev.db')
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

                                                  P4001 The introspected database was empty: 

                                                  prisma introspect could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the yarn prisma generate command.

                                                  To fix this, you have two options:

                                                  - manually create a table in your database (using SQL).
                                                  - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

                                                  Then you can run yarn prisma introspect again. 

                                        `)
})

it('should fail when db is empty', async () => {
  ctx.fixture('schema-db-out-of-sync')
  ctx.fs.write('dev.db', '')
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

                              P4001 The introspected database was empty: 

                              prisma introspect could not create any models in your schema.prisma file and you will not be able to generate Prisma Client with the yarn prisma generate command.

                              To fix this, you have two options:

                              - manually create a table in your database (using SQL).
                              - make sure the database connection URL inside the datasource block in schema.prisma points to a database that is not empty (it must contain at least one table).

                              Then you can run yarn prisma introspect again. 

                        `)
})

it('should fail when prisma schema is missing', async () => {
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P1001

          Can't reach database server at \`introspection-prisma1.cg7tbvsdqlrs.eu-central-1.rds.amazonaws.com\`:\`3306\`

          Please make sure your database server is running at \`introspection-prisma1.cg7tbvsdqlrs.eu-central-1.rds.amazonaws.com\`:\`3306\`.

        `)
})

it('should fail when schema is invalid', async () => {
  ctx.fixture('introspect-force')
  const result = Introspect.new().parse([])
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
          P1012 Introspection failed as your current Prisma schema file is invalid

          Please fix your current schema manually, use yarn prisma validate to confirm it is valid and then run this command again.
          Or run this command with the --force flag to ignore your current schema and overwrite it. All local modifications will be lost.

        `)
})

it('should succeed when schema is invalid and using --force', async () => {
  ctx.fixture('introspect-force')

  expect(ctx.fs.read('prisma/schema.prisma')).toMatchInlineSnapshot(`
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/client"
    }

    datasource db {
      provider = "sqlite"
      url      = "file:dev.db"
    }

    model something {
      id Int
    }

  `)

  const result = Introspect.new().parse(['--force'])
  await expect(result).resolves.toMatchInlineSnapshot(``)

  expect(
    ctx.mocked['console.log'].mock.calls
      .join('\n')
      .replace(/\d{2,3}ms/, 'in XXms'),
  ).toMatchInlineSnapshot(`

                        Introspecting based on datasource defined in prisma/schema.prisma …

                        ✔ Introspected 3 models and wrote them into prisma/schema.prisma in in XXms
                              
                        Run yarn prisma generate to generate Prisma Client.
            `)

  expect(ctx.fs.read('prisma/schema.prisma')).toMatchInlineSnapshot(`
    generator client {
      provider = "prisma-client-js"
      output   = "../generated/client"
    }

    datasource db {
      provider = "sqlite"
      url      = "file:dev.db"
    }

    model Post {
      authorId  Int
      content   String?
      createdAt DateTime @default(now())
      id        Int      @default(autoincrement()) @id
      published Boolean  @default(false)
      title     String
      User      User     @relation(fields: [authorId], references: [id])
    }

    model Profile {
      bio    String?
      id     Int     @default(autoincrement()) @id
      userId Int     @unique
      User   User    @relation(fields: [userId], references: [id])
    }

    model User {
      email   String   @unique
      id      Int      @default(autoincrement()) @id
      name    String?
      Post    Post[]
      Profile Profile?
    }

  `)
})
