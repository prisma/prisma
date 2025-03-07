import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { DbPull } from '../../commands/DbPull'
import CaptureStdout from '../__helpers__/captureStdout'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).assemble()
const captureStdout = new CaptureStdout()

beforeEach(() => {
  captureStdout.startCapture()
})

afterEach(() => {
  captureStdout.clearCaptureText()
})

afterAll(() => {
  captureStdout.stopCapture()
})

// To avoid the loading spinner locally
process.env.CI = 'true'

test('reintrospection - no changes', async () => {
  ctx.fixture('introspection-folder')
  const introspect = new DbPull()
  const result = introspect.parse([], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()

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
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
  const result = introspect.parse(['--print'], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(captureStdout.getCapturedText().join('\n')).toMatchSnapshot()
})

test('reintrospection - new model', async () => {
  ctx.fixture('introspection-folder-new-model')
  const introspect = new DbPull()
  const result = introspect.parse([], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "config.prisma:

    generator client {
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
  const result = introspect.parse([], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "config.prisma:

    generator client {
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
  const result = introspect.parse([], defaultTestConfig())
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
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
  const result = introspect.parse([], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "Blog.prisma:




    config.prisma:

    generator client {
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
  const result = introspect.parse(['--force'], defaultTestConfig())
  await expect(result).resolves.toMatchInlineSnapshot(`""`)

  expect(ctx.printDir('prisma/schema', ['.prisma'])).toMatchInlineSnapshot(`
    "introspected.prisma:

    generator client {
      provider        = "prisma-client-js"
      output          = "@prisma/client"
      previewFeatures = ["prismaSchemaFolder"]
    }

    datasource my_db {
      provider = "sqlite"
      url      = "file:../dev.db"
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
