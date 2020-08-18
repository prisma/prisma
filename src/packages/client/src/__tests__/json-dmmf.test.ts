import { getDMMF } from '../'

const datamodel = `datasource my_db {
  provider = "postgres"
  url      = env("POSTGRES_URL")
}

model User {
  id           String     @default(cuid()) @id
  field Json?
}
`

test('JsonFilter should contain equals and not', async () => {
  const dmmf = await getDMMF({ datamodel })

  expect(dmmf.schema.inputTypes).toMatchInlineSnapshot(`
    Array [
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "equals",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "in",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "notIn",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "lt",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "lte",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "gt",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "gte",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "contains",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "startsWith",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "endsWith",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedStringFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "NestedStringFilter",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "equals",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "in",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "notIn",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "lt",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "lte",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "gt",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "gte",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "contains",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "startsWith",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "endsWith",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedStringFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "StringFilter",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
            ],
            "name": "equals",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedJsonNullableFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "NestedJsonNullableFilter",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
            ],
            "name": "equals",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedJsonNullableFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "JsonNullableFilter",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "UserWhereInput",
              },
            ],
            "name": "AND",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "UserWhereInput",
              },
            ],
            "name": "OR",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": true,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "UserWhereInput",
              },
            ],
            "name": "NOT",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "StringFilter",
              },
            ],
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "JsonNullableFilter",
              },
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "null",
              },
            ],
            "name": "field",
          },
        ],
        "isOneOf": false,
        "isWhereType": true,
        "name": "UserWhereInput",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "SortOrder",
              },
            ],
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "SortOrder",
              },
            ],
            "name": "field",
          },
        ],
        "isOneOf": true,
        "isOrderType": true,
        "name": "UserOrderByInput",
      },
      Object {
        "atLeastOne": true,
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "id",
          },
        ],
        "isOneOf": true,
        "name": "UserWhereUniqueInput",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
            ],
            "name": "field",
          },
        ],
        "isOneOf": false,
        "name": "UserCreateInput",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
            ],
            "name": "field",
          },
        ],
        "isOneOf": false,
        "name": "UserUpdateInput",
      },
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "scalar",
                "type": "String",
              },
            ],
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "Json",
              },
            ],
            "name": "field",
          },
        ],
        "isOneOf": false,
        "name": "UserUpdateManyMutationInput",
      },
    ]
  `)
})
