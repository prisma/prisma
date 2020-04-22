import { getDMMF } from '../generation/getDMMF'

const datamodel = `model User {
  id Int @id @default(autoincrement())
  name String
  email String @unique
  kind PostKind
}


enum PostKind {
  NICE
  AWESOME
}
`

describe('dmmf', () => {
  test('dmmf enum filter', async () => {
    const dmmf = await getDMMF({ datamodel })
    expect(dmmf.schema.inputTypes.find((i) => i.name === 'PostKindFilter'))
      .toMatchInlineSnapshot(`
      Object {
        "atLeastOne": false,
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
              },
            ],
            "isRelationFilter": false,
            "name": "equals",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
              },
              Object {
                "isList": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKindFilter",
              },
            ],
            "isRelationFilter": false,
            "name": "not",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
              },
            ],
            "isRelationFilter": false,
            "name": "in",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
              },
            ],
            "isRelationFilter": false,
            "name": "notIn",
          },
        ],
        "name": "PostKindFilter",
      }
    `)
  })
})
