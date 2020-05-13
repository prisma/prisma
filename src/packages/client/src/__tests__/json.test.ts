import { DMMFClass } from '../runtime/dmmf'
import { makeDocument } from '../runtime/query'
import { getDMMF } from '../generation/getDMMF'

const datamodel = `\
datasource db {
  provider = "postgres"
  url = env("DB")
}

model User {
  id    Int @id @default(autoincrement())
  name  String
  email String @unique
  json  Json
}`

let dmmf
beforeAll(async () => {
  const dmmfDocument = await getDMMF({ datamodel })
  dmmf = new DMMFClass(dmmfDocument)
})

describe('json', () => {
  test('should be able to create json', async () => {
    const document = makeDocument({
      dmmf,
      select: {
        data: {
          email: 'a@a.de',
          json: {
            hello: 'world',
          },
          name: 'Bob',
        },
      },
      rootTypeName: 'mutation',
      rootField: 'createOneUser',
    })
    expect(String(document)).toMatchInlineSnapshot(`
      "mutation {
        createOneUser(data: {
          email: \\"a@a.de\\"
          json: \\"{\\\\\\"hello\\\\\\":\\\\\\"world\\\\\\"}\\"
          name: \\"Bob\\"
        }) {
          id
          name
          email
          json
        }
      }"
    `)
  })
})
