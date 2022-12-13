import { IntrospectionEngine } from '../../IntrospectionEngine'

test('introspection basic', async () => {
  const engine = new IntrospectionEngine({
    cwd: __dirname,
  })

  const url = `file:./blog.db`

  const schema = `datasource ds {
    provider = "sqlite"
    url = "${url}"
  }`

  const result = await engine.introspect(schema)
  expect(result).toMatchInlineSnapshot(`
    {
      "datamodel": "datasource ds {
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
      "version": "NonPrisma",
      "warnings": [],
    }
  `)
  const metadata = await engine.getDatabaseMetadata(schema)
  expect(metadata).toMatchInlineSnapshot(`
    {
      "size_in_bytes": 53248,
      "table_count": 3,
    }
  `)

  const dbVersion = await engine.getDatabaseVersion(schema)
  expect(dbVersion.length > 0).toBe(true)

  const description = await engine.getDatabaseDescription(schema)
  expect(typeof description).toBe('string')
  expect(description.length).toBeGreaterThan(1000)

  const json = JSON.parse(description)
  expect(typeof json).toBe('object')
  engine.stop()
})
