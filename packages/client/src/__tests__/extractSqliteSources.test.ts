import { extractSqliteSources } from '../generation/extractSqliteSources'
import { serializeDatasources } from '../generation/serializeDatasources'

test('ignore comments', () => {
  const datamodel = `datasource db {
    provider = "sqlite"
    // url = "file:another/wrong/folder/dev.db"
    url      = "file:my/folder/dev.db"
  }

  generator client {
    provider  = "prisma-client-js"
    output    = "@prisma/client"
    transpile = false
  }

  model User {
    id    String  @id @default(uuid())
    email String  @unique
    name  String?
    posts Post[]
  }

  model Post {
    id         String   @id @default(uuid())
    createdAt  DateTime @default(now())
    updatedAt  DateTime @updatedAt
    randomDate DateTime
    published  Boolean
    title      String
    content    String?
    author     User?
  }

  /// Role num comment
  enum Role {
    USER
    ADMIN
  }`

  const result = extractSqliteSources(datamodel, '/cwd', '/outputdir')

  expect(result).toMatchInlineSnapshot(`
    [
      {
        name: db,
        url: ../cwd/my/folder/dev.db,
      },
    ]
  `)

  let serializedResult = serializeDatasources(result)

  // TODO: Windows: fixup to work around a bug in jestSnapshotSerializer
  if (process.platform === 'win32') {
    serializedResult = serializedResult.replace(/\\\\/g, '/')
  }

  expect(serializedResult).toMatchInlineSnapshot(`
    [
      {
        "name": "db",
        "url": "../cwd/my/folder/dev.db"
      }
    ]
  `)
})

test('basic happy path', () => {
  const datamodel = `datasource db {
    provider = "sqlite"
    url      = "file:my/folder/dev.db"
    
  }

  generator client {
    provider  = "prisma-client-js"
    output    = "@prisma/client"
    transpile = false
  }

  model User {
    id    String  @id @default(uuid())
    email String  @unique
    name  String?
    posts Post[]
  }

  model Post {
    id         String   @id @default(uuid())
    createdAt  DateTime @default(now())
    updatedAt  DateTime @updatedAt
    randomDate DateTime
    published  Boolean
    title      String
    content    String?
    author     User?
  }

  /// Role num comment
  enum Role {
    USER
    ADMIN
  }`

  const result = extractSqliteSources(datamodel, '/cwd', '/outputdir')

  expect(result).toMatchInlineSnapshot(`
    [
      {
        name: db,
        url: ../cwd/my/folder/dev.db,
      },
    ]
  `)

  let serializedResult = serializeDatasources(result)

  // TODO: Windows: fixup to work around a bug in jestSnapshotSerializer
  if (process.platform === 'win32') {
    serializedResult = serializedResult.replace(/\\\\/g, '/')
  }

  expect(serializedResult).toMatchInlineSnapshot(`
    [
      {
        "name": "db",
        "url": "../cwd/my/folder/dev.db"
      }
    ]
  `)
})
