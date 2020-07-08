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
    Object {
      "datamodel": "datasource ds {
      provider = \\"sqlite\\"
      url      = \\"file:./blog.db\\"
    }

    model User {
      age     Int     @default(0)
      amount  Float   @default(0)
      balance Float   @default(0)
      email   String  @default(\\"\\") @unique
      id      Int     @default(autoincrement()) @id
      name    String?
      role    String  @default(\\"USER\\")
      Post    Post[]
    }

    model Post {
      author    Int
      content   String?
      createdAt DateTime @default(dbgenerated())
      kind      String?
      published Boolean  @default(false)
      title     String   @default(\\"\\")
      updatedAt DateTime @default(dbgenerated())
      uuid      String   @id
      User      User     @relation(fields: [author], references: [id])
    }
    ",
      "version": "NonPrisma",
      "warnings": Array [],
    }
  `)
  const metadata = await engine.getDatabaseMetadata(schema)
  expect(metadata).toMatchInlineSnapshot(`
          Object {
            "size_in_bytes": 0,
            "table_count": 3,
          }
      `)
  const databases = await engine.listDatabases(schema)
  expect(databases).toMatchInlineSnapshot(`
          Array [
            "",
            "blog.db",
          ]
      `)
  const description = await engine.getDatabaseDescription(schema)
  expect(JSON.parse(description)).toMatchInlineSnapshot(`
    Object {
      "enums": Array [],
      "sequences": Array [],
      "tables": Array [
        Object {
          "columns": Array [
            Object {
              "autoIncrement": true,
              "default": null,
              "name": "revision",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "name",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "datamodel",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "status",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "applied",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "rolled_back",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "datamodel_steps",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "database_migration",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "errors",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "started_at",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "DATE",
                "family": "dateTime",
                "fullDataType": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "finished_at",
              "tpe": Object {
                "arity": "nullable",
                "characterMaximumLength": null,
                "dataType": "DATE",
                "family": "dateTime",
                "fullDataType": "DATE",
              },
            },
          ],
          "foreignKeys": Array [],
          "indices": Array [],
          "name": "_Migration",
          "primaryKey": Object {
            "columns": Array [
              "revision",
            ],
            "constraintName": null,
            "sequence": null,
          },
        },
        Object {
          "columns": Array [
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": 0,
              },
              "name": "age",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": 0,
              },
              "name": "amount",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "REAL",
                "family": "float",
                "fullDataType": "REAL",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": 0,
              },
              "name": "balance",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "REAL",
                "family": "float",
                "fullDataType": "REAL",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": "",
              },
              "name": "email",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": true,
              "default": null,
              "name": "id",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "name",
              "tpe": Object {
                "arity": "nullable",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": "USER",
              },
              "name": "role",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
          ],
          "foreignKeys": Array [],
          "indices": Array [
            Object {
              "columns": Array [
                "email",
              ],
              "name": "User.email",
              "tpe": "unique",
            },
            Object {
              "columns": Array [
                "id",
              ],
              "name": "User.id",
              "tpe": "unique",
            },
          ],
          "name": "User",
          "primaryKey": Object {
            "columns": Array [
              "id",
            ],
            "constraintName": null,
            "sequence": null,
          },
        },
        Object {
          "columns": Array [
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "author",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "INTEGER",
                "family": "int",
                "fullDataType": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "content",
              "tpe": Object {
                "arity": "nullable",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "DBGENERATED": "'1970-01-01 00:00:00'",
              },
              "name": "createdAt",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "DATE",
                "family": "dateTime",
                "fullDataType": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "kind",
              "tpe": Object {
                "arity": "nullable",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": false,
              },
              "name": "published",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "BOOLEAN",
                "family": "boolean",
                "fullDataType": "BOOLEAN",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "VALUE": "",
              },
              "name": "title",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": Object {
                "DBGENERATED": "'1970-01-01 00:00:00'",
              },
              "name": "updatedAt",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "DATE",
                "family": "dateTime",
                "fullDataType": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "uuid",
              "tpe": Object {
                "arity": "required",
                "characterMaximumLength": null,
                "dataType": "TEXT",
                "family": "string",
                "fullDataType": "TEXT",
              },
            },
          ],
          "foreignKeys": Array [
            Object {
              "columns": Array [
                "author",
              ],
              "constraintName": null,
              "onDeleteAction": "restrict",
              "referencedColumns": Array [
                "id",
              ],
              "referencedTable": "User",
            },
          ],
          "indices": Array [
            Object {
              "columns": Array [
                "uuid",
              ],
              "name": "Post.uuid",
              "tpe": "unique",
            },
          ],
          "name": "Post",
          "primaryKey": Object {
            "columns": Array [
              "uuid",
            ],
            "constraintName": null,
            "sequence": null,
          },
        },
      ],
    }
  `)
  engine.stop()
})
