import { IntrospectionEngine } from '../../IntrospectionEngine'
import path from 'path'

test('basic introspection', async () => {
  const engine = new IntrospectionEngine({
    cwd: __dirname,
  })

  const url = `file:${path.resolve(__dirname, 'blog.db')}`

  const result = await engine.introspect(url)
  expect(result).toMatchInlineSnapshot(`
    "model User {
      age     Int     @default(0)
      amount  Float   @default(0)
      balance Float   @default(0)
      email   String  @default(\\"\\") @unique
      id      Int     @default(autoincrement()) @id
      name    String?
      role    String  @default(\\"USER\\")
      posts   Post[]
    }

    model Post {
      content   String?
      createdAt DateTime
      kind      String?
      published Boolean  @default(false)
      title     String   @default(\\"\\")
      updatedAt DateTime
      uuid      String   @id
      author    User
    }"
  `)
  const metadata = await engine.getDatabaseMetadata(url)
  expect(metadata).toMatchInlineSnapshot(`
    Object {
      "size_in_bytes": 0,
      "table_count": 3,
    }
  `)
  const databases = await engine.listDatabases(url)
  expect(databases).toMatchInlineSnapshot(`
    Array [
      "",
      "blog.db",
    ]
  `)
  const description = await engine.getDatabaseDescription(url)
  expect(JSON.parse(description)).toMatchInlineSnapshot(`
    Object {
      "enums": Array [],
      "sequences": Array [],
      "tables": Array [
        Object {
          "columns": Array [
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "applied",
              "tpe": Object {
                "arity": "required",
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "database_migration",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "datamodel",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "datamodel_steps",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "errors",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "finished_at",
              "tpe": Object {
                "arity": "nullable",
                "family": "dateTime",
                "raw": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "name",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": true,
              "default": null,
              "name": "revision",
              "tpe": Object {
                "arity": "required",
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "rolled_back",
              "tpe": Object {
                "arity": "required",
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "started_at",
              "tpe": Object {
                "arity": "required",
                "family": "dateTime",
                "raw": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "status",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
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
            "sequence": null,
          },
        },
        Object {
          "columns": Array [
            Object {
              "autoIncrement": false,
              "default": "0",
              "name": "age",
              "tpe": Object {
                "arity": "required",
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "0",
              "name": "amount",
              "tpe": Object {
                "arity": "required",
                "family": "float",
                "raw": "REAL",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "0",
              "name": "balance",
              "tpe": Object {
                "arity": "required",
                "family": "float",
                "raw": "REAL",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "",
              "name": "email",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": true,
              "default": null,
              "name": "id",
              "tpe": Object {
                "arity": "required",
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "name",
              "tpe": Object {
                "arity": "nullable",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "USER",
              "name": "role",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
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
                "family": "int",
                "raw": "INTEGER",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "content",
              "tpe": Object {
                "arity": "nullable",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "1970-01-01 00:00:00",
              "name": "createdAt",
              "tpe": Object {
                "arity": "required",
                "family": "dateTime",
                "raw": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "kind",
              "tpe": Object {
                "arity": "nullable",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "false",
              "name": "published",
              "tpe": Object {
                "arity": "required",
                "family": "boolean",
                "raw": "BOOLEAN",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "",
              "name": "title",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
              },
            },
            Object {
              "autoIncrement": false,
              "default": "1970-01-01 00:00:00",
              "name": "updatedAt",
              "tpe": Object {
                "arity": "required",
                "family": "dateTime",
                "raw": "DATE",
              },
            },
            Object {
              "autoIncrement": false,
              "default": null,
              "name": "uuid",
              "tpe": Object {
                "arity": "required",
                "family": "string",
                "raw": "TEXT",
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
            "sequence": null,
          },
        },
      ],
    }
  `)
  engine.stop()
})
