import { toSchemasContainer } from '@prisma/internals'
import fs from 'node:fs'
import path from 'node:path'

import { SchemaEngine } from '../../SchemaEngine'

test('introspection basic', async () => {
  const schemaPath = path.join(__dirname, 'schema.prisma')
  const engine = new SchemaEngine({
    projectDir: __dirname,
    schemaPath,
  })

  const schemaContent = await fs.promises.readFile(schemaPath, { encoding: 'utf-8' })

  const schema = toSchemasContainer([['schema.prisma', schemaContent]])

  const dbVersion = await engine.getDatabaseVersion({
    datasource: {
      tag: 'Schema',
      ...schema,
    },
  })
  expect(dbVersion.length > 0).toBe(true)

  const result = await engine.introspect({ schema, baseDirectoryPath: __dirname })
  expect(result).toMatchInlineSnapshot(`
    {
      "schema": {
        "files": [
          {
            "content": "datasource db {
      provider = "sqlite"
      url      = "file:./blog.db"
    }

    model Post {
      author    Int
      content   String?
      createdAt DateTime @default(dbgenerated("'1970-01-01 00:00:00'"))
      kind      String?
      published Boolean  @default(false)
      title     String   @default("")
      updatedAt DateTime @default(dbgenerated("'1970-01-01 00:00:00'"))
      uuid      String   @id @unique(map: "Post.uuid")
      User      User     @relation(fields: [author], references: [id], onUpdate: NoAction)
    }

    model User {
      age     Int     @default(0)
      amount  Float   @default(0)
      balance Float   @default(0)
      email   String  @unique(map: "User.email") @default("")
      id      Int     @id @unique(map: "User.id") @default(autoincrement())
      name    String?
      role    String  @default("USER")
      Post    Post[]
    }
    ",
            "path": "schema.prisma",
          },
        ],
      },
      "views": null,
      "warnings": null,
    }
  `)
})
