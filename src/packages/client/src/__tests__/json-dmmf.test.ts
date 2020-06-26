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
        "atLeastOne": false,
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
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "StringFilter",
              },
            ],
            "isRelationFilter": false,
            "name": "id",
            "nullEqualsUndefined": undefined,
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "object",
                "type": "NullableJsonFilter",
              },
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "null",
              },
            ],
            "isRelationFilter": false,
            "name": "field",
            "nullEqualsUndefined": undefined,
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
            "isRelationFilter": true,
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
            "isRelationFilter": true,
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
            "isRelationFilter": true,
            "name": "NOT",
          },
        ],
        "isWhereType": true,
        "name": "UserWhereInput",
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
        "name": "UserUpdateManyMutationInput",
      },
      Object {
        "atLeastOne": false,
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
            "isRelationFilter": false,
            "name": "equals",
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
                "kind": "scalar",
                "type": "StringFilter",
              },
            ],
            "isRelationFilter": false,
            "name": "not",
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
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
            "isRelationFilter": false,
            "name": "endsWith",
          },
        ],
        "name": "StringFilter",
      },
      Object {
        "atLeastOne": false,
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
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "null",
              },
            ],
            "isRelationFilter": false,
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
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "null",
              },
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "scalar",
                "type": "NullableJsonFilter",
              },
            ],
            "isRelationFilter": false,
            "name": "not",
          },
        ],
        "name": "NullableJsonFilter",
      },
      Object {
        "atLeastOne": true,
        "atMostOne": true,
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "enum",
                "type": "OrderByArg",
              },
            ],
            "isRelationFilter": false,
            "name": "id",
          },
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": true,
                "isRequired": false,
                "kind": "enum",
                "type": "OrderByArg",
              },
            ],
            "isRelationFilter": false,
            "name": "field",
          },
        ],
        "isOrderType": true,
        "name": "UserOrderByInput",
      },
    ]
  `)
})
