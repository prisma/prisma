import stripAnsi from 'strip-ansi'
import { getDMMF } from '../generation/getDMMF'

describe('dmmf', () => {
  test('dmmf enum filter mysql', async () => {
    const datamodel = `
      datasource db {
        provider = "mysql"
        url      = env("MY_MYSQL_DB")
      }
      
      model User {
        id Int @id @default(autoincrement())
        name String
        email String @unique
        kind PostKind
      }
      
      enum PostKind {
        NICE
        AWESOME
      }`

    const dmmf = await getDMMF({ datamodel })
    expect(
      dmmf.schema.inputTypes.find((i) => i.name === 'NestedEnumPostKindFilter'),
    ).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "object",
                "type": "NestedEnumPostKindFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "NestedEnumPostKindFilter",
      }
    `)
    expect(dmmf.schema.inputTypes.find((i) => i.name === 'EnumPostKindFilter'))
      .toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedEnumPostKindFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "EnumPostKindFilter",
      }
    `)
  })

  test('dmmf enum filter postgresql', async () => {
    const datamodel = `
      datasource db {
        provider = "postgresql"
        url      = env("MY_POSTGRES_DB")
      }
      
      model User {
        id Int @id @default(autoincrement())
        name String
        email String @unique
        kind PostKind
      }
      
      enum PostKind {
        NICE
        AWESOME
      }`

    const dmmf = await getDMMF({ datamodel })
    expect(
      dmmf.schema.inputTypes.find((i) => i.name === 'NestedEnumPostKindFilter'),
    ).toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "object",
                "type": "NestedEnumPostKindFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "NestedEnumPostKindFilter",
      }
    `)
    expect(dmmf.schema.inputTypes.find((i) => i.name === 'EnumPostKindFilter'))
      .toMatchInlineSnapshot(`
      Object {
        "fields": Array [
          Object {
            "inputType": Array [
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
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
                "kind": "enum",
                "type": "PostKind",
              },
              Object {
                "isList": false,
                "isNullable": false,
                "isRequired": false,
                "kind": "object",
                "type": "NestedEnumPostKindFilter",
              },
            ],
            "name": "not",
          },
        ],
        "isOneOf": false,
        "name": "EnumPostKindFilter",
      }
    `)
  })

  test('dmmf enum should fail on sqlite', async () => {
    const datamodel = `
      datasource db {
        provider = "sqlite"
        url      = "file:./dev.db"
      }

      model User {
        id Int @id @default(autoincrement())
        name String
        email String @unique
        kind PostKind
      }

      enum PostKind {
        NICE
        AWESOME
      }`

    /* eslint-disable jest/no-try-expect */
    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(stripAnsi(e.message)).toMatchInlineSnapshot(`
        "Schema parsing
        error: Error validating: You defined the enum \`PostKind\`. But the current connector does not support enums.
          -->  schema.prisma:14
           | 
        13 | 
        14 |       enum PostKind {
        15 |         NICE
        16 |         AWESOME
        17 |       }
           | 

        Validation Error Count: 1"
      `)
    }
    /* eslint-enable jest/no-try-expect */
  })
})
