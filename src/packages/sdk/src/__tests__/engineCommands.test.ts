import { getDMMF, getConfig, formatSchema } from '../engineCommands'
import stripAnsi from 'strip-ansi'
import fs from 'fs'
import path from 'path'

jest.setTimeout(10000)

describe('getDMMF', () => {
  test('simple model', async () => {
    const dmmf = await getDMMF({
      datamodel: `model A {
    id Int @id
    name String
  }`,
    })

    expect(dmmf.datamodel).toMatchInlineSnapshot(`
      Object {
        "enums": Array [],
        "models": Array [
          Object {
            "dbName": null,
            "fields": Array [
              Object {
                "hasDefaultValue": false,
                "isGenerated": false,
                "isId": true,
                "isList": false,
                "isReadOnly": false,
                "isRequired": true,
                "isUnique": false,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "id",
                "type": "Int",
              },
              Object {
                "hasDefaultValue": false,
                "isGenerated": false,
                "isId": false,
                "isList": false,
                "isReadOnly": false,
                "isRequired": true,
                "isUnique": false,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "name",
                "type": "String",
              },
            ],
            "idFields": Array [],
            "isEmbedded": false,
            "isGenerated": false,
            "name": "A",
            "uniqueFields": Array [],
            "uniqueIndexes": Array [],
          },
        ],
      }
    `)
    expect(dmmf).toMatchSnapshot()
  })

  test('@@map model', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      model User {
        id        Int      @default(autoincrement())
        email     String   @unique
        @@map("users")
      }`,
    })
    expect(dmmf.datamodel).toMatchInlineSnapshot(`
      Object {
        "enums": Array [],
        "models": Array [
          Object {
            "dbName": "users",
            "fields": Array [
              Object {
                "default": Object {
                  "args": Array [],
                  "name": "autoincrement",
                },
                "hasDefaultValue": true,
                "isGenerated": false,
                "isId": false,
                "isList": false,
                "isReadOnly": false,
                "isRequired": true,
                "isUnique": false,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "id",
                "type": "Int",
              },
              Object {
                "hasDefaultValue": false,
                "isGenerated": false,
                "isId": false,
                "isList": false,
                "isReadOnly": false,
                "isRequired": true,
                "isUnique": true,
                "isUpdatedAt": false,
                "kind": "scalar",
                "name": "email",
                "type": "String",
              },
            ],
            "idFields": Array [],
            "isEmbedded": false,
            "isGenerated": false,
            "name": "User",
            "uniqueFields": Array [],
            "uniqueIndexes": Array [],
          },
        ],
      }
    `)
    expect(dmmf).toMatchSnapshot()
  })

  test('@@unique model', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      // From https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-model#examples-3
      // Specify a multi-field unique attribute that includes a relation field
      model Post {
        id        Int     @default(autoincrement())
        author    User    @relation(fields: [authorId], references: [id])
        authorId  Int
        title     String
        published Boolean @default(false)
        
        @@unique([authorId, title])
      }
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
        posts Post[]
      }

      // Specify a multi-field unique attribute on two String fields
      model User1 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName])
      }
      
      // Specify a multi-field unique attribute on two String fields and one Boolean field
      model User2 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName, isAdmin])
      }
  `,
    })

    expect(dmmf).toMatchSnapshot()
  })

  test('@@unique model connectOrCreate', async () => {
    const dmmf = await getDMMF({
      datamodel: `
      // From https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-schema/data-model#examples-3
      // Specify a multi-field unique attribute that includes a relation field
      model Post {
        id        Int     @default(autoincrement())
        author    User    @relation(fields: [authorId], references: [id])
        authorId  Int
        title     String
        published Boolean @default(false)
        
        @@unique([authorId, title])
      }
      model User {
        id    Int    @id @default(autoincrement())
        email String @unique
        posts Post[]
      }

      // Specify a multi-field unique attribute on two String fields
      model User1 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName])
      }
      
      // Specify a multi-field unique attribute on two String fields and one Boolean field
      model User2 {
        id        Int     @default(autoincrement())
        firstName String
        lastName  String
        isAdmin   Boolean @default(false)
        @@unique([firstName, lastName, isAdmin])
      }
  `,
      enableExperimental: ['connectOrCreate'],
    })

    expect(dmmf).toMatchSnapshot()
  })

  test('chinook introspected schema', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/chinook.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchInlineSnapshot(`392668`)
  })

  test('chinook introspected schema connectOrCreate', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/chinook.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
      enableExperimental: ['connectOrCreate'],
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchInlineSnapshot(`407484`)
  })

  test('big schema', async () => {
    const file = fs.readFileSync(
      path.join(__dirname, '../../fixtures/bigschema.prisma'),
      'utf-8',
    )
    const dmmf = await getDMMF({
      datamodel: file,
      enableExperimental: ['connectOrCreate'],
    })
    const str = JSON.stringify(dmmf)
    expect(str.length).toMatchInlineSnapshot(`55151669`)
  })

  test('with validation errors', async () => {
    const datamodel = `generator client {
      provider = "prisma-client-js"
    }
    
    datasource my_db {
      provider = "sqlite"
      url      = "file:dev.db"
    }
    
    model User {
      id           String     @id @default(cuid())
      id           String     @id @default(cuid())
      name         String
      email        String     @unique
      status       String     @default("")
      permissions  Permission @default()
      permissions  Permission @default("")
      posts        Post[]
      posts        Post[]
    }
    
    model Post {
      id        String   @id @default(cuid())
      name      String
      email     String   @unique
      createdAt DateTime @default(now())
      updatedAt DateTime @updatedAt
    }
    
    enum Permission {
      ADMIN
      USER
      OWNER
      COLLABORATOR
    }
    `
    /* eslint-disable jest/no-try-expect */
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchSnapshot()
    }
    /* eslint-enable jest/no-try-expect */
  })
})

describe('getConfig', () => {
  test('empty config', async () => {
    const config = await getConfig({
      datamodel: `model A {
      id Int @id
      name String
    }`,
    })

    expect(config).toMatchSnapshot()
  })

  test('with generator and datasource', async () => {
    const config = await getConfig({
      datamodel: `
    datasource db {
      url = "file:dev.db"
      provider = "sqlite"
    }

    generator gen {
      provider = "fancy-provider"
      binaryTargets = ["native"]
    }

    model A {
      id Int @id
      name String
    }`,
    })

    expect(config).toMatchSnapshot()
  })

  test('datasource with env var', async () => {
    process.env.TEST_POSTGRES_URI_FOR_DATASOURCE =
      'postgres://user:password@something:5432/db'

    const config = await getConfig({
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("TEST_POSTGRES_URI_FOR_DATASOURCE")
      }
      `,
    })

    expect(config).toMatchInlineSnapshot(`
      Object {
        "datasources": Array [
          Object {
            "activeProvider": "postgresql",
            "name": "db",
            "provider": Array [
              "postgresql",
            ],
            "url": Object {
              "fromEnvVar": "TEST_POSTGRES_URI_FOR_DATASOURCE",
              "value": "postgres://user:password@something:5432/db",
            },
          },
        ],
        "generators": Array [],
      }
    `)
  })

  test('datasource with env var - ignoreEnvVarErrors', async () => {
    const config = await getConfig({
      ignoreEnvVarErrors: true,
      datamodel: `
      datasource db {
        provider = "postgresql"
        url      = env("SOMETHING-SOMETHING-1234")
      }
      `,
    })

    expect(config).toMatchInlineSnapshot(`
      Object {
        "datasources": Array [
          Object {
            "activeProvider": "postgresql",
            "name": "db",
            "provider": Array [
              "postgresql",
            ],
            "url": Object {
              "fromEnvVar": null,
              "value": "postgresql://",
            },
          },
        ],
        "generators": Array [],
      }
    `)
  })
})

describe('format', () => {
  test('valid blog schema', async () => {
    const formatted = await formatSchema({
      schemaPath: path.join(__dirname, 'fixtures/blog.prisma'),
    })

    expect(formatted).toMatchInlineSnapshot(`
      "datasource db {
        provider = \\"sqlite\\"
        url      = \\"file:dev.db\\"
      }

      generator client {
        provider      = \\"prisma-client-js\\"
        binaryTargets = [\\"native\\"]
      }

      model User {
        id    String  @default(cuid()) @id
        email String  @unique
        name  String?
        posts Post[]
        Like  Like[]
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
        Like      Like[]
      }

      model Like {
        id     String @default(cuid()) @id
        userId String
        user   User   @relation(fields: [userId], references: [id])
        postId String
        post   Post   @relation(fields: [postId], references: [id])

        @@unique([userId, postId])
      }"
    `)
  })
})
