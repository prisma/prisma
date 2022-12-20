import fs from 'fs'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { jestConsoleContext, jestContext } from '../..'
import { formatSchema } from '../../engine-commands'
import { fixturesPath } from '../__utils__/fixtures'

if (process.env.CI) {
  jest.setTimeout(20_000)
}

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('format wasm', () => {
  describe('diff', () => {
    test('2-spaces', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-2-spaces.prisma'), {
        encoding: 'utf8',
      })
      const formattedSchema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema.prisma'), {
        encoding: 'utf8',
      })
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedSchema).toEqual(formattedByWasm)
    })

    test('2-spaces-as-tab', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-2-spaces-as-tab.prisma'), {
        encoding: 'utf8',
      })
      const formattedSchema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema.prisma'), {
        encoding: 'utf8',
      })
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedSchema).toEqual(formattedByWasm)
    })

    test('4-spaces', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-4-spaces.prisma'), {
        encoding: 'utf8',
      })
      const formattedSchema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema.prisma'), {
        encoding: 'utf8',
      })
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedSchema).toEqual(formattedByWasm)
    })

    test('4-spaces-as-tab', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-4-spaces-as-tab.prisma'), {
        encoding: 'utf8',
      })
      const formattedSchema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema.prisma'), {
        encoding: 'utf8',
      })
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedSchema).toEqual(formattedByWasm)
    })
  })
})

describe('format custom options', () => {
  const schema = `
  datasource db {
   provider = "sqlite"
   url  = "file:dev.db"
  }
  
  model User {
   id String @default(cuid()) @id
   email String @unique
   name String?
   posts Post[]
  }
`

  test('tabSize=2', async () => {
    const formatted = await formatSchema({ schema }, { tabSize: 2 })
    expect(formatted).toMatchInlineSnapshot(`
      "datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }

      model User {
        id    String  @id @default(cuid())
        email String  @unique
        name  String?
        posts Post[]
      }
      "
    `)
  })

  test('tabSize=4', async () => {
    const formatted = await formatSchema({ schema }, { tabSize: 4 })
    expect(formatted).toMatchInlineSnapshot(`
      "datasource db {
          provider = "sqlite"
          url      = "file:dev.db"
      }

      model User {
          id    String  @id @default(cuid())
          email String  @unique
          name  String?
          posts Post[]
      }
      "
    `)
  })
})

describe('format', () => {
  test('nothing', async () => {
    try {
      // @ts-expect-error
      await formatSchema({})
    } catch (e) {
      expect(e.message).toMatchSnapshot()
    }
  })

  test('valid blog schemaPath', async () => {
    const formatted = await formatSchema({
      schemaPath: path.join(fixturesPath, 'blog.prisma'),
    })

    expect(formatted).toMatchSnapshot()
  })

  test('valid blog schema', async () => {
    const formatted = await formatSchema({
      schema: `
      datasource db {
        provider = "sqlite"
        url      = "file:dev.db"
      }
      
      generator client {
        provider      = "prisma-client-js"
        binaryTargets = ["native"]
      }
      
      model User {
        id    String  @default(cuid()) @id
        email String  @unique
        name  String?
        posts Post[]
      }
      
      model Post {
        id        String   @default(cuid()) @id
        createdAt DateTime @default(now())
        updatedAt DateTime @updatedAt
        published Boolean
        title     String
        content   String?
        authorId  String?
        author    User?    @relation(fields: [authorId], references: [id])
      }
      
      model Like {
        id     String @default(cuid()) @id
        userId String
        user   User   @relation(fields: [userId], references: [id])
        postId String
        post   Post   @relation(fields: [postId], references: [id])
      
        @@unique([userId, postId])
      }`,
    })

    expect(formatted).toMatchSnapshot()
  })

  test('valid schema with 1 preview feature flag warning', async () => {
    const schema = /* prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["cockroachdb"]
      }

      datasource db {
        provider = "cockroachdb"
        url = env("TEST_POSTGRES_URI")
      }

      model SomeUser {
        id   Int    @id
      }
    `
    const formattedSchema = await formatSchema({ schema })
    expect(formattedSchema).toMatchSnapshot()

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(stripAnsi(ctx.mocked['console.warn'].mock.calls.join('\n'))).toMatchInlineSnapshot(`
      "
      Prisma schema warning:
      - Preview feature "cockroachdb" is deprecated. The functionality can be used without specifying it as a preview feature."
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('valid schema with 3 preview feature flag warnings', async () => {
    const schema = /* prisma */ `
      generator client {
        provider = "prisma-client-js"
        previewFeatures = ["cockroachdb", "mongoDb", "microsoftSqlServer"]
      }

      datasource db {
        provider = "cockroachdb"
        url = env("TEST_POSTGRES_URI")
      }

      model SomeUser {
        id   Int    @id
      }
    `
    const formattedSchema = await formatSchema({ schema })
    expect(formattedSchema).toMatchSnapshot()

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(stripAnsi(ctx.mocked['console.warn'].mock.calls.join('\n'))).toMatchInlineSnapshot(`
      "
      Prisma schema warnings:
      - Preview feature "cockroachdb" is deprecated. The functionality can be used without specifying it as a preview feature.
      - Preview feature "mongoDb" is deprecated. The functionality can be used without specifying it as a preview feature.
      - Preview feature "microsoftSqlServer" is deprecated. The functionality can be used without specifying it as a preview feature."
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  test('invalid schema', async () => {
    const schema = /* prisma */ `
      generator client {
        provider        = "prisma-client-js"
      }

      datasource db {
        provider = "cockroachdb"
        url      = env("TEST_POSTGRES_URI")
      }

      model SomeUser {
        id      Int      @id
        profile Profile?
      }

      model Profile {
        id     Int      @id
        user   SomeUser @relation(fields: [userId], references: [id], onUpdate: SetNull)
        userId Int      @unique
      }
    `
    const formattedSchema = await formatSchema({ schema })
    expect(formattedSchema).toMatchInlineSnapshot(`
      "generator client {
        provider = "prisma-client-js"
      }

      datasource db {
        provider = "cockroachdb"
        url      = env("TEST_POSTGRES_URI")
      }

      model SomeUser {
        id      Int      @id
        profile Profile?
      }

      model Profile {
        id     Int      @id
        user   SomeUser @relation(fields: [userId], references: [id], onUpdate: SetNull)
        userId Int      @unique
      }
      "
    `)

    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })
})
