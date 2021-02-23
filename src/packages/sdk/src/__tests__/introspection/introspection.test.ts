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

    model Post {
      author    Int
      content   String?
      createdAt DateTime @default(dbgenerated(\\"'1970-01-01 00:00:00'\\"))
      kind      String?
      published Boolean  @default(false)
      title     String   @default(\\"\\")
      updatedAt DateTime @default(dbgenerated(\\"'1970-01-01 00:00:00'\\"))
      uuid      String   @id
      User      User     @relation(fields: [author], references: [id])
    }

    model User {
      age     Int     @default(0)
      amount  Float   @default(0)
      balance Float   @default(0)
      email   String  @unique @default(\\"\\")
      id      Int     @id @default(autoincrement())
      name    String?
      role    String  @default(\\"USER\\")
      Post    Post[]
    }
    ",
      "version": "NonPrisma",
      "warnings": Array [],
    }
  `)
  const metadata = await engine.getDatabaseMetadata(schema)
  expect(metadata).toMatchInlineSnapshot(`
    Object {
      "size_in_bytes": 53248,
      "table_count": 3,
    }
  `)
  const databases = await engine.listDatabases(schema)
  expect(databases).toMatchInlineSnapshot(`
    Array [
      "blog.db",
    ]
  `)

  const dbVersion = await engine.getDatabaseVersion(schema)
  expect(dbVersion.length > 0).toBe(true)

  const description = await engine.getDatabaseDescription(schema)

  expect(description).toMatchInlineSnapshot(`
    "SqlSchema {
        tables: [
            Table {
                name: \\"Post\\",
                columns: [
                    Column {
                        name: \\"author\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"content\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Nullable,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"createdAt\\",
                        tpe: ColumnType {
                            full_data_type: \\"DATE\\",
                            family: DateTime,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: DBGENERATED(
                                    \\"\\\\'1970-01-01 00:00:00\\\\'\\",
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"kind\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Nullable,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"published\\",
                        tpe: ColumnType {
                            full_data_type: \\"BOOLEAN\\",
                            family: Boolean,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    Boolean(
                                        false,
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"title\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    String(
                                        \\"\\",
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"updatedAt\\",
                        tpe: ColumnType {
                            full_data_type: \\"DATE\\",
                            family: DateTime,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: DBGENERATED(
                                    \\"\\\\'1970-01-01 00:00:00\\\\'\\",
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"uuid\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                ],
                indices: [
                    Index {
                        name: \\"Post.uuid\\",
                        columns: [
                            \\"uuid\\",
                        ],
                        tpe: Unique,
                    },
                ],
                primary_key: Some(
                    PrimaryKey {
                        columns: [
                            \\"uuid\\",
                        ],
                        sequence: None,
                        constraint_name: None,
                    },
                ),
                foreign_keys: [
                    ForeignKey {
                        constraint_name: None,
                        columns: [
                            \\"author\\",
                        ],
                        referenced_table: \\"User\\",
                        referenced_columns: [
                            \\"id\\",
                        ],
                        on_delete_action: Restrict,
                        on_update_action: NoAction,
                    },
                ],
            },
            Table {
                name: \\"User\\",
                columns: [
                    Column {
                        name: \\"age\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    Int(
                                        0,
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"amount\\",
                        tpe: ColumnType {
                            full_data_type: \\"REAL\\",
                            family: Float,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    Float(
                                        BigDecimal(\\"0\\"),
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"balance\\",
                        tpe: ColumnType {
                            full_data_type: \\"REAL\\",
                            family: Float,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    Float(
                                        BigDecimal(\\"0\\"),
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"email\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    String(
                                        \\"\\",
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                    Column {
                        name: \\"id\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: true,
                    },
                    Column {
                        name: \\"name\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Nullable,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"role\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: Some(
                            DefaultValue {
                                kind: VALUE(
                                    String(
                                        \\"USER\\",
                                    ),
                                ),
                                constraint_name: None,
                            },
                        ),
                        auto_increment: false,
                    },
                ],
                indices: [
                    Index {
                        name: \\"User.email\\",
                        columns: [
                            \\"email\\",
                        ],
                        tpe: Unique,
                    },
                    Index {
                        name: \\"User.id\\",
                        columns: [
                            \\"id\\",
                        ],
                        tpe: Unique,
                    },
                ],
                primary_key: Some(
                    PrimaryKey {
                        columns: [
                            \\"id\\",
                        ],
                        sequence: None,
                        constraint_name: None,
                    },
                ),
                foreign_keys: [],
            },
            Table {
                name: \\"_Migration\\",
                columns: [
                    Column {
                        name: \\"revision\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: true,
                    },
                    Column {
                        name: \\"name\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"datamodel\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"status\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"applied\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"rolled_back\\",
                        tpe: ColumnType {
                            full_data_type: \\"INTEGER\\",
                            family: Int,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"datamodel_steps\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"database_migration\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"errors\\",
                        tpe: ColumnType {
                            full_data_type: \\"TEXT\\",
                            family: String,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"started_at\\",
                        tpe: ColumnType {
                            full_data_type: \\"DATE\\",
                            family: DateTime,
                            arity: Required,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                    Column {
                        name: \\"finished_at\\",
                        tpe: ColumnType {
                            full_data_type: \\"DATE\\",
                            family: DateTime,
                            arity: Nullable,
                            native_type: None,
                        },
                        default: None,
                        auto_increment: false,
                    },
                ],
                indices: [],
                primary_key: Some(
                    PrimaryKey {
                        columns: [
                            \\"revision\\",
                        ],
                        sequence: None,
                        constraint_name: None,
                    },
                ),
                foreign_keys: [],
            },
        ],
        enums: [],
        sequences: [],
        views: [],
        procedures: [],
    }"
  `)
  engine.stop()
})
