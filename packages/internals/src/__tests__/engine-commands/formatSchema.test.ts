import execa from 'execa'
import fs from 'fs'
import path from 'path'

import { BinaryType, formatSchema, resolveBinary } from '../..'
import { fixturesPath } from '../__utils__/fixtures'

if (process.env.CI) {
  jest.setTimeout(20_000)
}

async function formatSchemaBinary(schema: string): Promise<string> {
  const MAX_BUFFER = 1_000_000_000
  const prismaFmtPath = await resolveBinary(BinaryType.prismaFmt)

  const options = {
    env: {
      RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
    },
    maxBuffer: MAX_BUFFER,
  } as execa.Options

  const formattedSchema = await execa(prismaFmtPath, ['format'], {
    ...options,
    input: schema,
  })

  return formattedSchema.stdout
}

describe('format wasm vs binary', () => {
  describe('diff', () => {
    test('2-spaces', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-2-spaces.prisma'), {
        encoding: 'utf8',
      })
      const formattedByBinary = await formatSchemaBinary(schema)
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedByBinary + '\n').toEqual(formattedByWasm)
    })

    test('2-spaces-as-tab', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-2-spaces-as-tab.prisma'), {
        encoding: 'utf8',
      })
      const formattedByBinary = await formatSchemaBinary(schema)
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedByBinary + '\n').toEqual(formattedByWasm)
    })

    test('4-spaces', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-4-spaces.prisma'), {
        encoding: 'utf8',
      })
      const formattedByBinary = await formatSchemaBinary(schema)
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedByBinary + '\n').toEqual(formattedByWasm)
    })

    test('4-spaces-as-tab', async () => {
      const schema = await fs.promises.readFile(path.join(fixturesPath, 'format', 'schema-4-spaces-as-tab.prisma'), {
        encoding: 'utf8',
      })
      const formattedByBinary = await formatSchemaBinary(schema)
      const formattedByWasm = await formatSchema({ schema })
      expect(formattedByBinary + '\n').toEqual(formattedByWasm)
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
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
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
          provider = \\"sqlite\\"
          url      = \\"file:dev.db\\"
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
})
