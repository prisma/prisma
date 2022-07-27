import { serializeQueryEngineName } from '@prisma/internals'
import fs from 'fs'
import lzString from 'lz-string'
import path from 'path'
import stripAnsi from 'strip-ansi'

import { getDMMF } from '../generation/getDMMF'
import { escapeJson } from '../generation/TSClient/helpers'

function getBytes(string) {
  return Buffer.byteLength(string, 'utf8')
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

async function computeDMMFSizeAndPrint(schema) {
  const modelsCount = (schema.match(/^model\s+/gm) || []).length

  // See buildDMMF()
  const dmmf = await getDMMF({ datamodel: schema })
  const { datamodel, mappings } = dmmf
  const dmmfString = escapeJson(JSON.stringify({ datamodel, mappings }))

  // Uncompressed
  const dmmfStringSize = getBytes(dmmfString)
  console.log(`dmmf ${modelsCount} models size: ${formatBytes(dmmfStringSize)}`)

  // Compressed = Data Proxy
  const compressedDMMF = lzString.compressToBase64(dmmfString)
  const compressedDMMFSize = getBytes(compressedDMMF)
  console.log(`dmmf ${modelsCount} models compressed size: ${formatBytes(compressedDMMFSize)}`)
}

describe('dmmf', () => {
  test('dmmf enum filter mysql', async () => {
    const datamodel = /* Prisma */ `
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
    expect(dmmf.schema.inputObjectTypes.prisma.find((i) => i.name === 'NestedEnumPostKindFilter'))
      .toMatchInlineSnapshot(`
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
    expect(dmmf.schema.inputObjectTypes.prisma.find((i) => i.name === 'EnumPostKindFilter')).toMatchInlineSnapshot(`
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
    const datamodel = /* Prisma */ `
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
    expect(dmmf.schema.inputObjectTypes.prisma.find((i) => i.name === 'NestedEnumPostKindFilter'))
      .toMatchInlineSnapshot(`
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
    expect(dmmf.schema.inputObjectTypes.prisma.find((i) => i.name === 'EnumPostKindFilter')).toMatchInlineSnapshot(`
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
    const datamodel = /* Prisma */ `
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

    try {
      await getDMMF({ datamodel })
    } catch (e) {
      expect(serializeQueryEngineName(stripAnsi(e.message))).toMatchInlineSnapshot(`
        Get DMMF: Schema parsing - Error while interacting with query-engine-NORMALIZED
        Error code: P1012
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

        Prisma CLI Version : 0.0.0
      `)
    }
  })
})

describe('dmmf sizes', () => {
  test('dmmf 1 model size', async () => {
    const schema = /* Prisma */ `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
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

    await computeDMMFSizeAndPrint(schema)
  })

  test('dmmf 10 models size', async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schemas', 'postgresql.10models.prisma'), 'utf-8')
    await computeDMMFSizeAndPrint(schema)
  })

  test('dmmf northwind 20 models size', async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schemas', 'mariadb.northwind.prisma'), 'utf-8')
    await computeDMMFSizeAndPrint(schema)
  })

  test('dmmf allsquare 200 models size', async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schemas', 'mysql.allsquare.prisma'), 'utf-8')
    await computeDMMFSizeAndPrint(schema)
  })
})
