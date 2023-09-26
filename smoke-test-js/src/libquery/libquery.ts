import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import type { ErrorCapturingDriverAdapter } from '@prisma/driver-adapter-utils'
import type { QueryEngineInstance } from '../engines/types/Library'
import { createQueryFn, initQueryEngine } from './util'
import { JsonQuery } from '../engines/types/JsonProtocol'

export function smokeTestLibquery(adapter: ErrorCapturingDriverAdapter, prismaSchemaRelativePath: string) {
  const engine = initQueryEngine(adapter, prismaSchemaRelativePath)
  const flavour = adapter.flavour

  const doQuery = createQueryFn(engine, adapter)

  describe('using libquery with Driver Adapters', () => {
    before(async () => {
      await engine.connect('trace')
    })

    after(async () => {
      await engine.disconnect('trace')
      await adapter.close()
    })

    it('create JSON values', async () => {
      const json = JSON.stringify({
        foo: 'bar',
        baz: 1,
      })

      const created = await doQuery({
        action: 'createOne',
        modelName: 'Product',
        query: {
          arguments: {
            data: {
              properties: json,
              properties_null: null,
            },
          },
          selection: {
            properties: true,
          },
        },
      })

      if (flavour !== 'sqlite') {
        assert.strictEqual(created.data.createOneProduct.properties.$type, 'Json')
      }

      console.log('[nodejs] created', JSON.stringify(created, null, 2))

      const resultSet = await doQuery({
        action: 'findMany',
        modelName: 'Product',
        query: {
          selection: {
            id: true,
            properties: true,
            properties_null: true,
          },
        },
      })
      console.log('[nodejs] resultSet', JSON.stringify(resultSet, null, 2))

      await doQuery({
        action: 'deleteMany',
        modelName: 'Product',
        query: {
          arguments: {
            where: {},
          },
          selection: {
            count: true,
          },
        },
      })
    })

    it('create with autoincrement', async () => {
      await doQuery({
        modelName: 'Author',
        action: 'deleteMany',
        query: {
          arguments: {
            where: {},
          },
          selection: {
            count: true,
          },
        },
      })

      const author = await doQuery({
        modelName: 'Author',
        action: 'createOne',
        query: {
          arguments: {
            data: {
              firstName: 'Firstname from autoincrement',
              lastName: 'Lastname from autoincrement',
              age: 99,
            },
          },
          selection: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      })
      console.log('[nodejs] author', JSON.stringify(author, null, 2))
    })

    it('create non scalar types', async () => {
      const create = await doQuery({
        action: 'createOne',
        modelName: 'type_test_2',
        query: {
          arguments: {
            data: {},
          },
          selection: {
            id: true,
            datetime_column: true,
            datetime_column_null: true,
          },
        },
      })

      console.log('[nodejs] create', JSON.stringify(create, null, 2))

      const resultSet = await doQuery({
        action: 'findMany',
        modelName: 'type_test_2',
        query: {
          selection: {
            id: true,
            datetime_column: true,
            datetime_column_null: true,
          },
          arguments: {
            where: {},
          },
        },
      })

      console.log('[nodejs] resultSet', JSON.stringify(resultSet, null, 2))

      await doQuery({
        action: 'deleteMany',
        modelName: 'type_test_2',
        query: {
          arguments: {
            where: {},
          },
          selection: {
            count: true,
          },
        },
      })
    })

    it('create/delete parent and child', async () => {
      /* Delete all child and parent records */

      // Queries: [
      //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
      //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
      //   'DELETE FROM `cf-users`.`Child` WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)'
      // ]
      await doQuery({
        modelName: 'Child',
        action: 'deleteMany',
        query: {
          arguments: {
            where: {},
          },
          selection: {
            count: true,
          },
        },
      })

      // Queries: [
      //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
      //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
      //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND 1=1)'
      // ]
      await doQuery({
        modelName: 'Parent',
        action: 'deleteMany',
        query: {
          arguments: {
            where: {},
          },
          selection: {
            count: true,
          },
        },
      })

      /* Create a parent with some new children, within a transaction */

      // Queries: [
      //   'INSERT INTO `cf-users`.`Parent` (`p`,`p_1`,`p_2`,`id`) VALUES (?,?,?,?)',
      //   'INSERT INTO `cf-users`.`Child` (`c`,`c_1`,`c_2`,`parentId`,`id`) VALUES (?,?,?,?,?)',
      //   'SELECT `cf-users`.`Parent`.`id`, `cf-users`.`Parent`.`p` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`id` = ? LIMIT ? OFFSET ?',
      //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`c`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE `cf-users`.`Child`.`parentId` IN (?)'
      // ]
      await doQuery({
        modelName: 'Parent',
        action: 'createOne',
        query: {
          arguments: {
            data: {
              p: 'p1',
              p_1: '1',
              p_2: '2',
              childOpt: {
                create: {
                  c: 'c1',
                  c_1: 'foo',
                  c_2: 'bar',
                },
              },
            },
          },
          selection: {
            p: true,
            childOpt: {
              selection: {
                c: true,
              },
            },
          },
        },
      })

      /* Delete the parent */

      // Queries: [
      //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
      //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE (1=1 AND `cf-users`.`Child`.`parentId` IN (?))',
      //   'UPDATE `cf-users`.`Child` SET `parentId` = ? WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)',
      //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
      //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND `cf-users`.`Parent`.`p` = ?)'
      // ]
      await doQuery({
        modelName: 'Parent',
        action: 'deleteMany',
        query: {
          arguments: {
            where: {
              p: 'p1',
            },
          },
          selection: {
            count: true,
          },
        },
      })
    })

    it('create explicit transaction', async () => {
      const args = { isolation_level: 'Serializable', max_wait: 5000, timeout: 15000 }
      const startResponse = await engine.startTransaction(JSON.stringify(args), 'trace')
      const tx_id = JSON.parse(startResponse).id

      console.log('[nodejs] transaction id', tx_id)
      await doQuery(
        {
          action: 'findMany',
          modelName: 'Author',
          query: {
            selection: { $scalars: true },
          },
        },
        tx_id,
      )

      const commitResponse = await engine.commitTransaction(tx_id, 'trace')
      console.log('[nodejs] commited', commitResponse)
    })

    it('expected error', async () => {
      const result = await doQuery({
        modelName: 'Unique',
        action: 'createMany',
        query: {
          arguments: {
            data: [{ email: 'duplicate@example.com' }, { email: 'duplicate@example.com' }],
          },
          selection: {
            $scalars: true,
          },
        },
      })

      console.log('[nodejs] error result', JSON.stringify(result, null, 2))
    })

    describe('read scalar and non scalar types', () => {
      if (['mysql'].includes(flavour)) {
        it('mysql', async () => {
          const resultSet = await doQuery({
            action: 'findMany',
            modelName: 'type_test',
            query: {
              selection: {
                tinyint_column: true,
                smallint_column: true,
                mediumint_column: true,
                int_column: true,
                bigint_column: true,
                float_column: true,
                double_column: true,
                decimal_column: true,
                boolean_column: true,
                char_column: true,
                varchar_column: true,
                text_column: true,
                date_column: true,
                time_column: true,
                datetime_column: true,
                timestamp_column: true,
                json_column: true,
                enum_column: true,
                binary_column: true,
                varbinary_column: true,
                blob_column: true,
              },
            },
          })

          console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))
        })
      } else if (['postgres'].includes(flavour)) {
        it('postgres', async () => {
          const resultSet = await doQuery({
            action: 'findMany',
            modelName: 'type_test',
            query: {
              selection: {
                smallint_column: true,
                int_column: true,
                bigint_column: true,
                float_column: true,
                double_column: true,
                decimal_column: true,
                boolean_column: true,
                char_column: true,
                varchar_column: true,
                text_column: true,
                date_column: true,
                time_column: true,
                datetime_column: true,
                timestamp_column: true,
                json_column: true,
                enum_column: true,
              },
            },
          })
          console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))
        })
      } else if (['sqlite'].includes(flavour)) {
        it('sqlite', async () => {
          const resultSet = await doQuery(
            {
              "action": "findMany",
              "modelName": "type_test",
              "query": {
                "selection": {
                  "int_column": true,
                  "bigint_column": true,
                  "double_column": true,
                  "decimal_column": true,
                  "boolean_column": true,
                  "text_column": true,
                  "datetime_column": true,
                }
              }
            }
          )
          console.log('[nodejs] findMany resultSet', JSON.stringify((resultSet), null, 2))
        })
      } else {
        throw new Error(`Missing test for flavour ${flavour}`)
      }
    })

    it('write and read back bytes', async () => {
      const createResultSet = await doQuery({
        action: 'createOne',
        modelName: 'type_test_3',
        query: {
          selection: {
            bytes: true,
          },
          arguments:  {
            data: {
              bytes: {
                $type: 'Bytes',
                value: 'AQID',
              },
            },
          },
        },
      })
      console.log('[nodejs] createOne resultSet:')
      console.dir(createResultSet, { depth: Infinity })

      const findResultSet = await doQuery({
        action: 'findMany',
        modelName: 'type_test_3',
        query: {
          selection: {
            bytes: true,
          },
        },
      })
      console.log('[nodejs] findMany resultSet:')
      console.dir(findResultSet, { depth: Infinity })
    })
  })
}

class SmokeTest {
  readonly flavour: ErrorCapturingDriverAdapter['flavour']

  constructor(private readonly engine: QueryEngineInstance, private readonly connector: ErrorCapturingDriverAdapter) {
    this.flavour = connector.flavour
  }

  async testFindManyTypeTest() {
    await this.testFindManyTypeTestMySQL()
    await this.testFindManyTypeTestPostgres()
  }

  private async testFindManyTypeTestMySQL() {
    if (this.flavour !== 'mysql') {
      return
    }

    const resultSet = await this.doQuery({
      action: 'findMany',
      modelName: 'type_test',
      query: {
        selection: {
          tinyint_column: true,
          smallint_column: true,
          mediumint_column: true,
          int_column: true,
          bigint_column: true,
          float_column: true,
          double_column: true,
          decimal_column: true,
          boolean_column: true,
          char_column: true,
          varchar_column: true,
          text_column: true,
          date_column: true,
          time_column: true,
          datetime_column: true,
          timestamp_column: true,
          json_column: true,
          enum_column: true,
          binary_column: true,
          varbinary_column: true,
          blob_column: true,
        },
      },
    })

    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))

    return resultSet
  }

  private async testFindManyTypeTestPostgres() {
    if (this.flavour !== 'postgres') {
      return
    }

    const resultSet = await this.doQuery({
      action: 'findMany',
      modelName: 'type_test',
      query: {
        selection: {
          smallint_column: true,
          int_column: true,
          bigint_column: true,
          float_column: true,
          double_column: true,
          decimal_column: true,
          boolean_column: true,
          char_column: true,
          varchar_column: true,
          text_column: true,
          date_column: true,
          time_column: true,
          datetime_column: true,
          timestamp_column: true,
          json_column: true,
          enum_column: true,
        },
      },
    })
    console.log('[nodejs] findMany resultSet', JSON.stringify(resultSet, null, 2))

    return resultSet
  }

  async createAutoIncrement() {
    await this.doQuery({
      modelName: 'Author',
      action: 'deleteMany',
      query: {
        arguments: {
          where: {},
        },
        selection: {
          count: true,
        },
      },
    })

    const author = await this.doQuery({
      modelName: 'Author',
      action: 'createOne',
      query: {
        arguments: {
          data: {
            firstName: 'Firstname from autoincrement',
            lastName: 'Lastname from autoincrement',
            age: 99,
          },
        },
        selection: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    })
    console.log('[nodejs] author', JSON.stringify(author, null, 2))
  }

  async testCreateAndDeleteChildParent() {
    /* Delete all child and parent records */

    // Queries: [
    //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
    //   'SELECT `cf-users`.`Child`.`id` FROM `cf-users`.`Child` WHERE 1=1',
    //   'DELETE FROM `cf-users`.`Child` WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)'
    // ]
    await this.doQuery({
      modelName: 'Child',
      action: 'deleteMany',
      query: {
        arguments: {
          where: {},
        },
        selection: {
          count: true,
        },
      },
    })

    // Queries: [
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE 1=1',
    //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND 1=1)'
    // ]
    await this.doQuery({
      modelName: 'Parent',
      action: 'deleteMany',
      query: {
        arguments: {
          where: {},
        },
        selection: {
          count: true,
        },
      },
    })

    /* Create a parent with some new children, within a transaction */

    // Queries: [
    //   'INSERT INTO `cf-users`.`Parent` (`p`,`p_1`,`p_2`,`id`) VALUES (?,?,?,?)',
    //   'INSERT INTO `cf-users`.`Child` (`c`,`c_1`,`c_2`,`parentId`,`id`) VALUES (?,?,?,?,?)',
    //   'SELECT `cf-users`.`Parent`.`id`, `cf-users`.`Parent`.`p` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`id` = ? LIMIT ? OFFSET ?',
    //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`c`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE `cf-users`.`Child`.`parentId` IN (?)'
    // ]
    await this.doQuery({
      modelName: 'Parent',
      action: 'createOne',
      query: {
        arguments: {
          data: {
            p: 'p1',
            p_1: '1',
            p_2: '2',
            childOpt: {
              create: {
                c: 'c1',
                c_1: 'foo',
                c_2: 'bar',
              },
            },
          },
        },
        selection: {
          p: true,
          childOpt: {
            selection: {
              c: true,
            },
          },
        },
      },
    })

    /* Delete the parent */

    // Queries: [
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
    //   'SELECT `cf-users`.`Child`.`id`, `cf-users`.`Child`.`parentId` FROM `cf-users`.`Child` WHERE (1=1 AND `cf-users`.`Child`.`parentId` IN (?))',
    //   'UPDATE `cf-users`.`Child` SET `parentId` = ? WHERE (`cf-users`.`Child`.`id` IN (?) AND 1=1)',
    //   'SELECT `cf-users`.`Parent`.`id` FROM `cf-users`.`Parent` WHERE `cf-users`.`Parent`.`p` = ?',
    //   'DELETE FROM `cf-users`.`Parent` WHERE (`cf-users`.`Parent`.`id` IN (?) AND `cf-users`.`Parent`.`p` = ?)'
    // ]
    const resultDeleteMany = await this.doQuery({
      modelName: 'Parent',
      action: 'deleteMany',
      query: {
        arguments: {
          where: {
            p: 'p1',
          },
        },
        selection: {
          count: true,
        },
      },
    })
    console.log('[nodejs] resultDeleteMany', JSON.stringify(resultDeleteMany, null, 2))
  }

  async testTransaction() {
    const startResponse = await this.engine.startTransaction(
      JSON.stringify({ isolation_level: 'Serializable', max_wait: 5000, timeout: 15000 }),
      'trace',
    )

    const tx_id = JSON.parse(startResponse).id

    console.log('[nodejs] transaction id', tx_id)
    await this.doQuery(
      {
        action: 'findMany',
        modelName: 'Author',
        query: {
          selection: { $scalars: true },
        },
      },
      tx_id,
    )

    const commitResponse = await this.engine.commitTransaction(tx_id, 'trace')
    console.log('[nodejs] commited', commitResponse)
  }

  private async doQuery(query: JsonQuery, tx_id?: string) {
    const result = await this.engine.query(JSON.stringify(query), 'trace', tx_id)
    const parsedResult = JSON.parse(result)
    if (parsedResult.errors) {
      const error = parsedResult.errors[0]?.user_facing_error
      if (error.error_code === 'P2036') {
        const jsError = this.connector.errorRegistry.consumeError(error.meta.id)
        if (!jsError) {
          throw new Error(
            `Something went wrong. Engine reported external error with id ${error.meta.id}, but it was not registered.`,
          )
        }
        throw jsError.error
      }
    }
    return parsedResult
  }
}
