import { setTimeout } from 'node:timers/promises'
import type { ErrorCapturingDriverAdapter } from '@jkomyno/prisma-driver-adapter-utils'
import type { QueryEngineInstance } from '../engines/types/Library'
import { initQueryEngine } from './util'
import { JsonQuery } from '../engines/types/JsonProtocol'

export async function smokeTestLibquery(db: ErrorCapturingDriverAdapter, prismaSchemaRelativePath: string) {
  const engine = initQueryEngine(db, prismaSchemaRelativePath)

  console.log('[nodejs] connecting...')
  await engine.connect('trace')
  console.log('[nodejs] connected')

  const test = new SmokeTest(engine, db)

  await test.testJSON()
  await test.testTypeTest2()
  await test.testFindManyTypeTest()
  await test.createAutoIncrement()
  await test.testCreateAndDeleteChildParent()
  await test.testTransaction()
  await test.testRawError()

  // Note: calling `engine.disconnect` won't actually close the database connection.
  console.log('[nodejs] disconnecting...')
  await engine.disconnect('trace')
  console.log('[nodejs] disconnected')

  console.log('[nodejs] re-connecting...')
  await engine.connect('trace')
  console.log('[nodejs] re-connecting')

  await setTimeout(0)

  console.log('[nodejs] re-disconnecting...')
  await engine.disconnect('trace')
  console.log('[nodejs] re-disconnected')

  // Close the database connection. This is required to prevent the process from hanging.
  console.log('[nodejs] closing database connection...')
  await db.close()
  console.log('[nodejs] closed database connection')
}

class SmokeTest {
  readonly flavour: ErrorCapturingDriverAdapter['flavour']

  constructor(private readonly engine: QueryEngineInstance, private readonly connector: ErrorCapturingDriverAdapter) {
    this.flavour = connector.flavour
  }

  async testJSON() {
    const json = JSON.stringify({
      foo: 'bar',
      baz: 1,
    })

    const created = await this.doQuery(
      {
        "action": "createOne",
        "modelName": "Product",
        "query": {
          "arguments": {
            "data": {
              "properties": json,
              "properties_null": null
            }
          },
          "selection": {
            "properties": true
          }
        }
      })

    console.log('[nodejs] created', JSON.stringify(created, null, 2))

    const resultSet = await this.doQuery(
      {
        "action": "findMany",
        "modelName": "Product",
        "query": {
          "selection": {
            "id": true,
            "properties": true,
            "properties_null": true
          }
        } 
      }
    )

    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))

    await this.doQuery(
      {
        "action": "deleteMany",
        "modelName": "Product",
        "query": {
          "arguments": {
            "where": {}
          },
          "selection": {
            "count": true
          }
        }
      }
    )

    return resultSet
  }

  async testTypeTest2() {
    const create = await this.doQuery(
      {
        "action": "createOne",
        "modelName": "type_test_2",
        "query": {
          "arguments": {
            "data": {}
          },
          "selection": {
            "id": true,
            "datetime_column": true,
            "datetime_column_null": true
          }
        }
      }
    )

    console.log('[nodejs] create', JSON.stringify(create, null, 2))

    const resultSet = await this.doQuery(
      {
        "action": "findMany",
        "modelName": "type_test_2",
        "query": {
          "selection": {
            "id": true,
            "datetime_column": true,
            "datetime_column_null": true
          },
          "arguments": {
            "where": {}
          }
        }
      }
    )

    console.log('[nodejs] resultSet', JSON.stringify(resultSet, null, 2))

    await this.doQuery(
      {
        "action": "deleteMany",
        "modelName": "type_test_2",
        "query": {
          "arguments": {
            "where": {}
          },
          "selection": {
            "count": true
          }
        }
      }
    )

    return resultSet
  }

  async testFindManyTypeTest() {
    await this.testFindManyTypeTestMySQL()
    await this.testFindManyTypeTestPostgres()
  }

  private async testFindManyTypeTestMySQL() {
    if (this.flavour !== 'mysql') {
      return
    }

    const resultSet = await this.doQuery(
      {
        "action": "findMany",
        "modelName": "type_test",
        "query": {
          "selection": {
            "tinyint_column": true,
            "smallint_column": true,
            "mediumint_column": true,
            "int_column": true,
            "bigint_column": true,
            "float_column": true,
            "double_column": true,
            "decimal_column": true,
            "boolean_column": true,
            "char_column": true,
            "varchar_column": true,
            "text_column": true,
            "date_column": true,
            "time_column": true,
            "datetime_column": true,
            "timestamp_column": true,
            "json_column": true,
            "enum_column": true,
            "binary_column": true,
            "varbinary_column": true,
            "blob_column": true
          }
        } 
      })

    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))
  
    return resultSet
  }

  private async testFindManyTypeTestPostgres() {
    if (this.flavour !== 'postgres') {
      return
    }

    const resultSet = await this.doQuery(
      {
        "action": "findMany",
        "modelName": "type_test",
        "query": {
          "selection": {
            "smallint_column": true,
            "int_column": true,
            "bigint_column": true,
            "float_column": true,
            "double_column": true,
            "decimal_column": true,
            "boolean_column": true,
            "char_column": true,
            "varchar_column": true,
            "text_column": true,
            "date_column": true,
            "time_column": true,
            "datetime_column": true,
            "timestamp_column": true,
            "json_column": true,
            "enum_column": true
          }
        } 
      }
    )
    console.log('[nodejs] findMany resultSet', JSON.stringify((resultSet), null, 2))
  
    return resultSet
  }

  async createAutoIncrement() {
    await this.doQuery(
      {
        "modelName": "Author",
        "action": "deleteMany",
        "query": {
          "arguments": {
            "where": {}
          },
          "selection": {
            "count": true
          }
        }
      }
    )

    const author = await this.doQuery(
      {
        "modelName": "Author",
        "action": "createOne",
        "query": {
          "arguments": {
            "data": {
              "firstName": "Firstname from autoincrement",
              "lastName": "Lastname from autoincrement",
              "age": 99
            }
          },
          "selection": {
            "id": true,
            "firstName": true,
            "lastName": true
          }
        }
      }
    )
    console.log('[nodejs] author', JSON.stringify(author, null, 2))
  }

  async testCreateAndDeleteChildParent() {
    /* Delete all child and parent records */
  
    // Queries: [
    //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
    //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
    //   'DELETE FROM `cf-users`.`Child` WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)'
    // ]
    await this.doQuery(
      {
        "modelName": "Child",
        "action": "deleteMany",
        "query": {
          "arguments": {
            "where": {}
          },
          "selection": {
            "count": true
          }
        }
      }
    )
  
    // Queries: [
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
    //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND 1=1)'
    // ]
    await this.doQuery(
      {
        "modelName": "Parent",
        "action": "deleteMany",
        "query": {
          "arguments": {
            "where": {}
          },
          "selection": {
            "count": true
          }
        }
      }
    )
  
    /* Create a parent with some new children, within a transaction */
  
    // Queries: [
    //   'INSERT INTO `cf-users`.`Parent` (`p`,`p_1`,`p_2`,`id`) VALUES (?,?,?,?)',
    //   'INSERT INTO `cf-users`.`Child` (`c`,`c_1`,`c_2`,`parentId`,`id`) VALUES (?,?,?,?,?)',
    //   'SELECT `cf-users`.`Parent`.`id`, `cf-users`.`Parent`.`p` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`id` = ? LIMIT ? OFFSET ?',
    //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`c`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE `cf-users`.`Child`.`parentId` IN (?)'
    // ]
    await this.doQuery(
      {
        "modelName": "Parent",
        "action": "createOne",
        "query": {
          "arguments": {
            "data": {
              "p": "p1",
              "p_1": "1",
              "p_2": "2",
              "childOpt": {
                "create": {
                  "c": "c1",
                  "c_1": "foo",
                  "c_2": "bar"
                }
              }
            }
          },
          "selection": {
            "p": true,
            "childOpt": {
              "selection": {
                "c": true
              }
            }
          }
        }
      }
    )
  
    /* Delete the parent */
  
    // Queries: [
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
    //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE (1=1 AND `cf-users`.`Child`.`parentId` IN (?))',
    //   'UPDATE `cf-users`.`Child` SET `parentId` = ? WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)',
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
    //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND `cf-users`.`Parent`.`p` = ?)'
    // ]
    const resultDeleteMany = await this.doQuery(
      {
        "modelName": "Parent",
        "action": "deleteMany",
        "query": {
          "arguments": {
            "where": {
              "p": "p1"
            }
          },
          "selection": {
            "count": true
          }
        }
      }
    )
    console.log('[nodejs] resultDeleteMany', JSON.stringify(resultDeleteMany, null, 2))
  }

  async testTransaction() {
    const startResponse = await this.engine.startTransaction(JSON.stringify({ isolation_level: 'Serializable', max_wait: 5000, timeout: 15000 }), 'trace')

    const tx_id = JSON.parse(startResponse).id

    console.log('[nodejs] transaction id', tx_id)
    await this.doQuery(
      {
        "action": "findMany",
        "modelName": "Author",
        "query": {
          "selection": { "$scalars": true }
        }
      },
      tx_id
    )

    const commitResponse = await this.engine.commitTransaction(tx_id, 'trace')
    console.log('[nodejs] commited', commitResponse)
  }

  async testRawError() {
    try {
      await this.doQuery({
        action: 'queryRaw',
        query: {
          selection: { $scalars: true },
          arguments: {
            query: 'NOT A VALID SQL, THIS WILL FAIL',
            parameters: '[]'
          }
        }
      })
      console.log(`[nodejs] expected exception, but query succeeded`)
    } catch (error) {
      console.log('[nodejs] caught expected error', error)
    }

  }

  private async doQuery(query: JsonQuery, tx_id?: string) {
    const result = await this.engine.query(JSON.stringify(query), 'trace', tx_id)
    const parsedResult = JSON.parse(result)
    if (parsedResult.errors) {
      const error = parsedResult.errors[0]?.user_facing_error
      if (error.error_code === 'P2036') {
        const jsError =  this.connector.errorRegistry.consumeError(error.meta.id)
        if (!jsError) {
          throw new Error(`Something went wrong. Engine reported external error with id ${error.meta.id}, but it was not registered.`)
        }
        throw jsError.error
      }
    }
    return parsedResult
  }
}
