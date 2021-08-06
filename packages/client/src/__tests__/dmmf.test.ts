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
      dmmf.schema.inputObjectTypes.prisma.find(
        (i) => i.name === 'NestedEnumPostKindFilter',
      ),
    ).toMatchInlineSnapshot(`
      Object {
        constraints: Object {
          maxNumFields: null,
          minNumFields: null,
        },
        fields: Array [
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: equals,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: in,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: notIn,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
              Object {
                isList: false,
                location: inputObjectTypes,
                namespace: prisma,
                type: NestedEnumPostKindFilter,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: not,
          },
        ],
        name: NestedEnumPostKindFilter,
      }
    `)
    expect(
      dmmf.schema.inputObjectTypes.prisma.find(
        (i) => i.name === 'EnumPostKindFilter',
      ),
    ).toMatchInlineSnapshot(`
      Object {
        constraints: Object {
          maxNumFields: null,
          minNumFields: null,
        },
        fields: Array [
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: equals,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: in,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: notIn,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
              Object {
                isList: false,
                location: inputObjectTypes,
                namespace: prisma,
                type: NestedEnumPostKindFilter,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: not,
          },
        ],
        name: EnumPostKindFilter,
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
      dmmf.schema.inputObjectTypes.prisma.find(
        (i) => i.name === 'NestedEnumPostKindFilter',
      ),
    ).toMatchInlineSnapshot(`
      Object {
        constraints: Object {
          maxNumFields: null,
          minNumFields: null,
        },
        fields: Array [
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: equals,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: in,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: notIn,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
              Object {
                isList: false,
                location: inputObjectTypes,
                namespace: prisma,
                type: NestedEnumPostKindFilter,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: not,
          },
        ],
        name: NestedEnumPostKindFilter,
      }
    `)
    expect(
      dmmf.schema.inputObjectTypes.prisma.find(
        (i) => i.name === 'EnumPostKindFilter',
      ),
    ).toMatchInlineSnapshot(`
      Object {
        constraints: Object {
          maxNumFields: null,
          minNumFields: null,
        },
        fields: Array [
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: equals,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: in,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: true,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: notIn,
          },
          Object {
            inputTypes: Array [
              Object {
                isList: false,
                location: enumTypes,
                namespace: model,
                type: PostKind,
              },
              Object {
                isList: false,
                location: inputObjectTypes,
                namespace: prisma,
                type: NestedEnumPostKindFilter,
              },
            ],
            isNullable: false,
            isRequired: false,
            name: not,
          },
        ],
        name: EnumPostKindFilter,
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
        Schema parsing
        error: Error validating: You defined the enum \`PostKind\`. But the current connector does not support enums.
          -->  schema.prisma:14
           | 
        13 | 
        14 |       enum PostKind {
        15 |         NICE
        16 |         AWESOME
        17 |       }
           | 

        Validation Error Count: 1
      `)
    }
    /* eslint-enable jest/no-try-expect */
  })
})
