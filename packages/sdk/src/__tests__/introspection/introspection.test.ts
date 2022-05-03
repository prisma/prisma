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
          \\"columns\\": [
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
          },
          \\"foreign_keys\\": [
            {
              \\"constraint_name\\": null,
              \\"columns\\": [
                \\"author\\"
              ],
              \\"referenced_table\\": \\"User\\",
              \\"referenced_columns\\": [
                \\"id\\"
              ],
              \\"on_delete_action\\": \\"Restrict\\",
              \\"on_update_action\\": \\"NoAction\\"
            }
          ]
        },
        {
          \\"name\\": \\"User\\",
          \\"columns\\": [
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
          },
          \\"foreign_keys\\": []
        },
        {
          \\"name\\": \\"_Migration\\",
          \\"columns\\": [
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
            },
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
          ],
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
          },
          \\"foreign_keys\\": []
        }
      ],
      \\"enums\\": [],
      \\"views\\": [],
      \\"procedures\\": [],
      \\"user_defined_types\\": [],
      \\"connector_data\\": null
    }"
  `)
  engine.stop()
})
