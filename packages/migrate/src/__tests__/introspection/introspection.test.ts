import fs from 'fs'
import path from 'path'

import { MigrateEngine } from '../../MigrateEngine'

test('introspection basic', async () => {
  const engine = new MigrateEngine({
    projectDir: __dirname,
    schemaPath: 'schema.prisma',
  })

  const schema = await fs.promises.readFile(path.join(__dirname, 'schema.prisma'), { encoding: 'utf-8' })

  const result = await engine.introspect({ schema })
  expect(result).toMatchInlineSnapshot(`
    {
      datamodel: datasource db {
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
    ,
      version: NonPrisma,
      views: null,
      warnings: null,
    }
  `)

  // TODO: uncomment once https://github.com/prisma/prisma-private/issues/203 is closed.
  // const dbVersion = await engine.getDatabaseVersion({ schema })
  // expect(dbVersion.length > 0).toBe(true)
})
