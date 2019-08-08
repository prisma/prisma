import { extractSqliteSources } from '../generation/extractSqliteSources'
import { serializeDatasources } from '../generation/serializeDatasources'

test('ignore comments', () => {
  const datamodel = `datasource db {
    provider = "sqlite"
    // url = "file:another/wrong/folder/dev.db"
    url      = "file:my/folder/dev.db"
    default  = true
  }
  
  generator photon {
    provider  = "photonjs"
    output    = "@generated/photon"
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
    Array [
      Object {
        "name": "db",
        "url": "'file:' + path.resolve(__dirname, '../cwd/my/folder/dev.db')",
      },
    ]
  `)

  expect(serializeDatasources(result)).toMatchInlineSnapshot(`
    "[
      {
        \\"name\\": \\"db\\",
        \\"url\\": 'file:' + path.resolve(__dirname, '../cwd/my/folder/dev.db')
      }
    ]"
  `)
})

test('basic happy path', () => {
  const datamodel = `datasource db {
    provider = "sqlite"
    url      = "file:my/folder/dev.db"
    default  = true
  }
  
  generator photon {
    provider  = "photonjs"
    output    = "@generated/photon"
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
                Array [
                  Object {
                    "name": "db",
                    "url": "'file:' + path.resolve(__dirname, '../cwd/my/folder/dev.db')",
                  },
                ]
        `)

  expect(serializeDatasources(result)).toMatchInlineSnapshot(`
            "[
              {
                \\"name\\": \\"db\\",
                \\"url\\": 'file:' + path.resolve(__dirname, '../cwd/my/folder/dev.db')
              }
            ]"
      `)
})
