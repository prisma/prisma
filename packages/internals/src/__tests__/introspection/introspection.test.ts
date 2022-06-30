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
      uuid      String   @id @unique(map: \\"Post.uuid\\")
      User      User     @relation(fields: [author], references: [id], onUpdate: NoAction)
    }

    model User {
      age     Int     @default(0)
      amount  Float   @default(0)
      balance Float   @default(0)
      email   String  @unique(map: \\"User.email\\") @default(\\"\\")
      id      Int     @id @unique(map: \\"User.id\\") @default(autoincrement())
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
    "{
      \\"tables\\": [
        {
          \\"name\\": \\"Post\\",
          \\"indices\\": [
            {
              \\"name\\": \\"Post.uuid\\",
              \\"columns\\": [
                {
                  \\"name\\": \\"uuid\\",
                  \\"sort_order\\": \\"Asc\\",
                  \\"length\\": null
                }
              ],
              \\"tpe\\": \\"Unique\\"
            }
          ],
          \\"primary_key\\": {
            \\"columns\\": [
              {
                \\"name\\": \\"uuid\\",
                \\"length\\": null,
                \\"sort_order\\": null
              }
            ],
            \\"constraint_name\\": null
          }
        },
        {
          \\"name\\": \\"User\\",
          \\"indices\\": [
            {
              \\"name\\": \\"User.email\\",
              \\"columns\\": [
                {
                  \\"name\\": \\"email\\",
                  \\"sort_order\\": \\"Asc\\",
                  \\"length\\": null
                }
              ],
              \\"tpe\\": \\"Unique\\"
            },
            {
              \\"name\\": \\"User.id\\",
              \\"columns\\": [
                {
                  \\"name\\": \\"id\\",
                  \\"sort_order\\": \\"Asc\\",
                  \\"length\\": null
                }
              ],
              \\"tpe\\": \\"Unique\\"
            }
          ],
          \\"primary_key\\": {
            \\"columns\\": [
              {
                \\"name\\": \\"id\\",
                \\"length\\": null,
                \\"sort_order\\": null
              }
            ],
            \\"constraint_name\\": null
          }
        },
        {
          \\"name\\": \\"_Migration\\",
          \\"indices\\": [],
          \\"primary_key\\": {
            \\"columns\\": [
              {
                \\"name\\": \\"revision\\",
                \\"length\\": null,
                \\"sort_order\\": null
              }
            ],
            \\"constraint_name\\": null
          }
        }
      ],
      \\"enums\\": [],
      \\"columns\\": [
        [
          0,
          {
            \\"name\\": \\"author\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"content\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Nullable\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"createdAt\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"DATE\\",
              \\"family\\": \\"DateTime\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"DbGenerated\\": \\"'1970-01-01 00:00:00'\\"
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"kind\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Nullable\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"published\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"BOOLEAN\\",
              \\"family\\": \\"Boolean\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": false
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"title\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": \\"\\"
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"updatedAt\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"DATE\\",
              \\"family\\": \\"DateTime\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"DbGenerated\\": \\"'1970-01-01 00:00:00'\\"
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          0,
          {
            \\"name\\": \\"uuid\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"age\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": 0
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"amount\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"REAL\\",
              \\"family\\": \\"Float\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": 0.0
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"balance\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"REAL\\",
              \\"family\\": \\"Float\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": 0.0
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"email\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": \\"\\"
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"id\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": true
          }
        ],
        [
          1,
          {
            \\"name\\": \\"name\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Nullable\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          1,
          {
            \\"name\\": \\"role\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": {
              \\"kind\\": {
                \\"Value\\": \\"USER\\"
              },
              \\"constraint_name\\": null
            },
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"revision\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": true
          }
        ],
        [
          2,
          {
            \\"name\\": \\"name\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"datamodel\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"status\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"applied\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"rolled_back\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"INTEGER\\",
              \\"family\\": \\"Int\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"datamodel_steps\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"database_migration\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"errors\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"TEXT\\",
              \\"family\\": \\"String\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"started_at\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"DATE\\",
              \\"family\\": \\"DateTime\\",
              \\"arity\\": \\"Required\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ],
        [
          2,
          {
            \\"name\\": \\"finished_at\\",
            \\"tpe\\": {
              \\"full_data_type\\": \\"DATE\\",
              \\"family\\": \\"DateTime\\",
              \\"arity\\": \\"Nullable\\",
              \\"native_type\\": null
            },
            \\"default\\": null,
            \\"auto_increment\\": false
          }
        ]
      ],
      \\"foreign_keys\\": [
        [
          0,
          {
            \\"constraint_name\\": null,
            \\"columns\\": [
              \\"author\\"
            ],
            \\"referenced_table\\": 1,
            \\"referenced_columns\\": [
              \\"id\\"
            ],
            \\"on_delete_action\\": \\"Restrict\\",
            \\"on_update_action\\": \\"NoAction\\"
          }
        ]
      ],
      \\"views\\": [],
      \\"procedures\\": [],
      \\"user_defined_types\\": [],
      \\"connector_data\\": null
    }"
  `)
  engine.stop()
})
