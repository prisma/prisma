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

  // TODO: remove `getDatabaseMetadata`, as it's used in tests only
  const metadata = await engine.getDatabaseMetadata(schema)
  expect(metadata).toMatchInlineSnapshot(`
    {
      "size_in_bytes": 53248,
      "table_count": 3,
    }
  `)

  const dbVersion = await engine.getDatabaseVersion(schema)
  expect(dbVersion.length > 0).toBe(true)

  // TODO: remove `getDatabaseDescription`, as it's only in the error reporting
  // to dump the database's SQL, which is a feature we haven't used in a long time
  // (Tom: never, Matthias: at most twice)
  const description = await engine.getDatabaseDescription(schema)
  expect(typeof description).toBe('string')
  expect(description.length).toBeGreaterThan(1000)

  const json = JSON.parse(description)
  expect(typeof json).toBe('object')

  engine.stop()
})
