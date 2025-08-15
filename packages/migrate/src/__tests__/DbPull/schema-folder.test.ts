import { DbPull } from '../../commands/DbPull'
import { createDefaultTestContext } from '../__helpers__/context'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = createDefaultTestContext()

test('reintrospection - no changes', async () => {
  ctx.fixture('introspection-folder')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
    "Prisma schema loaded from prisma/schema
    Datasource "my_db": SQLite database "dev.db" <location placeholder>

    - Introspecting based on datasource defined in prisma/schema
    ✔ Introspected 2 models and wrote them into prisma/schema in XXXms
          
    Run prisma generate to generate Prisma Client.
    "
  `)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "Blog.prisma:

    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      owner       User @relation(fields: [ownerId], references: [id])
    }


    config.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }


    User.prisma:

    model User {
      id    Int    @id @default(autoincrement())
      blogs Blog[]
    }
    "
  `)
})

test('reintrospection - with --print', async () => {
  ctx.fixture('introspection-folder')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema', '--print'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.normalizedCapturedStdout()).toMatchInlineSnapshot(`
    "// prisma/schema/Blog.prisma
    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      owner       User @relation(fields: [ownerId], references: [id])
    }

    // prisma/schema/config.prisma
    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }

    // prisma/schema/User.prisma
    model User {
      id    Int    @id @default(autoincrement())
      blogs Blog[]
    }

    "
  `)
})

test('reintrospection - new model', async () => {
  ctx.fixture('introspection-folder-new-model')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "config.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }


    introspected.prisma:

    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      User        User @relation(fields: [ownerId], references: [id])
    }


    User.prisma:

    model User {
      id   Int    @id @default(autoincrement())
      Blog Blog[]
    }
    "
  `)
})

test('reintrospection - new model - existing introspected.prisma', async () => {
  ctx.fixture('introspection-folder-new-model-with-introspected')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "config.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }


    introspected.prisma:

    model User {
      id   Int    @id @default(autoincrement())
      Blog Blog[]
    }

    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      User        User @relation(fields: [ownerId], references: [id])
    }
    "
  `)
})

test('reintrospection - new field', async () => {
  ctx.fixture('introspection-folder-new-field')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "Blog.prisma:

    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      owner       User @relation(fields: [ownerId], references: [id])
    }


    config.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }


    User.prisma:

    model User {
      id    Int    @id @default(autoincrement())
      blogs Blog[]
    }
    "
  `)
})

test('reintrospection - remove model', async () => {
  ctx.fixture('introspection-folder-remove-model')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "Blog.prisma:




    config.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }


    User.prisma:

    model User {
      id Int @id @default(autoincrement())
    }
    "
  `)
})

test('reintrospection - invalid schema with --force', async () => {
  ctx.fixture('introspection-folder-invalid')
  const introspect = new DbPull()
  const result = introspect.parse(['--schema=./prisma/schema', '--force'], await ctx.config())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "introspected.prisma:

    generator client {
      provider = "prisma-client-js"
      output   = "@prisma/client"
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../../dev.db"
    }

    model Blog {
      id          Int  @id @default(autoincrement())
      viewCount20 Int
      ownerId     Int
      User        User @relation(fields: [ownerId], references: [id])
    }

    model User {
      id   Int    @id @default(autoincrement())
      Blog Blog[]
    }
    "
  `)
})
