import path from 'path'

import { formatSchema } from '../..'
import { fixturesPath } from '../__utils__/fixtures'

if (process.env.CI) {
  jest.setTimeout(20_000)
}

describe('format custom options', () => {
  test('tabSize=2', async () => {
    const formatted = await formatSchema(
      {
        schema: `
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
      `,
      },
      { tabSize: 2 },
    )
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
    const formatted = await formatSchema(
      {
        schema: `
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
      `,
      },
      { tabSize: 4 },
    )
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
