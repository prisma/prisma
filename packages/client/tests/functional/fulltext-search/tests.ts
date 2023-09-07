import { ProviderFlavors } from '../_utils/providerFlavors'
import testMatrix from './_matrix'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

testMatrix.setupTestSuite(
  ({ providerFlavor, andQuery, orQuery, notQuery, noResultsQuery, badQuery }, _suiteMeta, clientMeta) => {
    beforeAll(async () => {
      await prisma.user.createMany({
        data: [
          {
            email: 'email1@email.io',
            name: 'John Smith',
          },
          {
            email: 'email2@email.io',
            name: 'April ONeal',
          },
          {
            email: 'email3@email.io',
            name: 'John Pearl',
          },
        ],
      })
    })

    test('AND query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: andQuery,
          },
        },
      })

      expect(result).toEqual([expect.objectContaining({ name: 'John Smith' })])
    })

    test('OR query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: orQuery,
          },
        },
      })

      expect(result).toHaveLength(3)
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Smith' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'April ONeal' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Pearl' }))
    })

    test('NOT query', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: notQuery,
          },
        },
      })

      expect(result).toHaveLength(2)
      expect(result).toContainEqual(expect.objectContaining({ name: 'April ONeal' }))
      expect(result).toContainEqual(expect.objectContaining({ name: 'John Pearl' }))
    })

    test('no results', async () => {
      const result = await prisma.user.findMany({
        where: {
          name: {
            search: noResultsQuery,
          },
        },
      })

      expect(result).toEqual([])
    })

    // TODO: Windows: why is this test skipped?
    // TODO: Edge: skipped because of the error snapshot
    testIf(process.platform !== 'win32' && clientMeta.runtime !== 'edge')('bad query', async () => {
      const result = prisma.user
        .findMany({
          where: {
            name: {
              search: badQuery,
            },
          },
        })
        .catch((error) => {
          // Remove `tsquery.c` line number to make error snapshots portable across PostgreSQL versions.
          error.message = error.message.replace(/line: Some\(\d+\)/, 'line: Some(0)')
          throw error
        })

      if (providerFlavor === ProviderFlavors.PG) {
        if (clientMeta.dataProxy) {
          // Error occurred during query execution:
          // + ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Error { kind: Db, cause: Some(DbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42601), message: "syntax error in tsquery: \"John Smith\"", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("tsquery.c"), line: Some(0), routine: Some("makepol") }) }), transient: false })
          await expect(result).rejects.toThrow(
            'code: SqlState(E42601), message: "syntax error in tsquery: \\"John Smith\\""',
          )
        } else {
          await expect(result).rejects.toThrow('syntax error in tsquery: "John Smith"')
        }
      } else if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
        // dataProxy === false
        // target: tests.0.primary: vttablet: rpc error: code = InvalidArgument desc = syntax error, unexpected '-' (errno 1064) (sqlstate 42000) (CallerID: userData1): Sql: \"select `User`.id, `User`.email, `User`.`name` from `User` where match(`User`.`name`) against (:vtg1 /* VARCHAR */ in boolean mode)\", BindVars: {#maxLimit: \"type:INT64 value:\\\"10001\\\"\"vtg1: \"type:VARCHAR value:\\\"John <--> Smith\\\"\"} (errno 1064) (sqlstate 42000) during query: SELECT `tests`.`User`.`id`, `tests`.`User`.`email`, `tests`.`User`.`name` FROM `tests`.`User` WHERE MATCH (`tests`.`User`.`name`)AGAINST ('John <--> Smith' IN BOOLEAN MODE)
        // dataProxy === true
        // ConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(Server(ServerError { code: 1064, message: \"target: tests.0.primary: vttablet: rpc error: code = InvalidArgument desc = syntax error, unexpected '-' (errno 1064) (sqlstate 42000) (CallerID: userData1): Sql: \\\"select `User`.id, `User`.email, `User`.`name` from `User` where match(`User`.`name`) against (:v1 in boolean mode) /* traceparent=00-0b4a62f0e970a7a0da3033b904aa3480-13e531f42efa6aca-01 */\\\", BindVars: {#maxLimit: \\\"type:INT64 value:\\\\\\\"10001\\\\\\\"\\\"v1: \\\"type:VARBINARY value:\\\\\\\"John <--> Smith\\\\\\\"\\\"}\", state: \"42000\" })), transient: false })
        await expect(result).rejects.toThrow(
          `code = InvalidArgument desc = syntax error, unexpected '-' (errno 1064) (sqlstate 42000)`,
        )
      } else {
        await expect(result).rejects.toMatchPrismaErrorSnapshot()
      }
    })

    test('order by relevance on a single field', async () => {
      const users = await prisma.user.findMany({
        orderBy: {
          _relevance: {
            fields: ['name'],
            search: 'John',
            sort: 'desc',
          },
        },
      })

      expect(users).toEqual([
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
        expect.objectContaining({ name: 'April ONeal' }),
      ])
    })

    test('order by relevance on multiple fields', async () => {
      const users = await prisma.user.findMany({
        orderBy: {
          _relevance: {
            fields: ['name', 'email'],
            search: 'John',
            sort: 'asc',
          },
        },
      })

      expect(users).toEqual([
        expect.objectContaining({ name: 'April ONeal' }),
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
      ])
    })

    test('order by relevance: multiple orderBy statements', async () => {
      const users = await prisma.user.findMany({
        orderBy: {
          _relevance: {
            fields: ['name'],
            search: 'John',
            sort: 'desc',
          },
        },
      })

      expect(users).toEqual([
        expect.objectContaining({ name: 'John Smith' }),
        expect.objectContaining({ name: 'John Pearl' }),
        expect.objectContaining({ name: 'April ONeal' }),
      ])
    })
  },
  {
    optOut: {
      from: ['sqlite', 'mongodb', 'cockroachdb', 'sqlserver'],
      reason: 'these connectors do not support full-text search',
    },
  },
)
