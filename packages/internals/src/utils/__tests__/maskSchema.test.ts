import { maskSchema } from '../maskSchema'

test('maskSchema', () => {
  const schema = `datasource db {
    url = "mysql:secret-db"
  }`
  expect(maskSchema(schema)).toMatchInlineSnapshot(`
        "datasource db {
            url = \\"***\\"
          }"
    `)

  const schema2 = `datasource db {
    provider = "mysql"
    url = env("SOME_ENV")
  }`
  expect(maskSchema(schema2)).toMatchInlineSnapshot(`
    "datasource db {
        provider = \\"mysql\\"
        url = \\"***\\"
      }"
  `)
})
