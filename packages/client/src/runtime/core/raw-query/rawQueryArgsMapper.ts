import Debug from '@prisma/debug'
import { RawValue, Sql } from 'sql-template-tag'

import { Client } from '../../getPrismaClient'
import { mssqlPreparedStatement } from '../../utils/mssqlPreparedStatement'
import { serializeRawParameters } from '../../utils/serializeRawParameters'
import { RawQueryArgs } from './RawQueryArgs'

const ALTER_RE = /^(\s*alter\s)/i

const debug = Debug('prisma:client')

// TODO also check/disallow for CREATE, DROP
function checkAlter(
  query: string,
  values: RawValue[],
  invalidCall:
    | 'prisma.$executeRaw`<SQL>`'
    | 'prisma.$executeRawUnsafe(<SQL>, [...values])'
    | 'prisma.$executeRaw(sql`<SQL>`)',
) {
  if (values.length > 0 && ALTER_RE.exec(query)) {
    // See https://github.com/prisma/prisma-client-js/issues/940 for more info
    throw new Error(`Running ALTER using ${invalidCall} is not supported
Using the example below you can still execute your query with Prisma, but please note that it is vulnerable to SQL injection attacks and requires you to take care of input sanitization.

Example:
  await prisma.$executeRawUnsafe(\`ALTER USER prisma WITH PASSWORD '\${password}'\`)

More Information: https://pris.ly/d/execute-raw
`)
  }
}

function isReadonlyArray(arg: any): arg is ReadonlyArray<any> {
  return Array.isArray(arg)
}

export const rawQueryArgsMapper =
  (client: Client, clientMethod: string) =>
  ([query, ...values]: RawQueryArgs) => {
    // TODO Clean up types
    let queryString = ''
    let parameters: { values: string; __prismaRawParameters__: true } | undefined
    if (typeof query === 'string') {
      // If this was called as prisma.$executeRaw(<SQL>, [...values]), assume it is a pre-prepared SQL statement, and forward it without any changes
      queryString = query
      parameters = {
        values: serializeRawParameters(values || []),
        __prismaRawParameters__: true,
      }
      if (clientMethod.includes('executeRaw')) {
        checkAlter(queryString, values, 'prisma.$executeRawUnsafe(<SQL>, [...values])')
      }
    } else if (isReadonlyArray(query)) {
      // If this was called as prisma.$executeRaw`<SQL>`, try to generate a SQL prepared statement
      switch (client._activeProvider) {
        case 'sqlite':
        case 'mysql': {
          const queryInstance = new Sql(query, values)

          queryString = queryInstance.sql
          parameters = {
            values: serializeRawParameters(queryInstance.values),
            __prismaRawParameters__: true,
          }
          break
        }

        case 'cockroachdb':
        case 'postgresql': {
          const queryInstance = new Sql(query, values)

          queryString = queryInstance.text
          if (clientMethod.includes('executeRaw')) {
            checkAlter(queryString, queryInstance.values, 'prisma.$executeRaw`<SQL>`')
          }

          parameters = {
            values: serializeRawParameters(queryInstance.values),
            __prismaRawParameters__: true,
          }
          break
        }

        case 'sqlserver': {
          queryString = mssqlPreparedStatement(query)
          parameters = {
            values: serializeRawParameters(values),
            __prismaRawParameters__: true,
          }
          break
        }
        default: {
          throw new Error(`The ${client._activeProvider} provider does not support ${clientMethod}`)
        }
      }
    } else {
      // If this was called as prisma.$executeRaw(sql`<SQL>`), use prepared statements from sql-template-tag
      switch (client._activeProvider) {
        case 'sqlite':
        case 'mysql':
          queryString = query.sql
          break
        case 'cockroachdb':
        case 'postgresql':
          queryString = query.text
          if (clientMethod.includes('executeRaw')) {
            checkAlter(queryString, query.values, 'prisma.$executeRaw(sql`<SQL>`)')
          }
          break
        case 'sqlserver':
          queryString = mssqlPreparedStatement(query.strings)
          break
        default:
          throw new Error(`The ${client._activeProvider} provider does not support ${clientMethod}`)
      }
      parameters = {
        values: serializeRawParameters(query.values),
        __prismaRawParameters__: true,
      }
    }

    if (parameters?.values) {
      debug(`prisma.${clientMethod}(${queryString}, ${parameters.values})`)
    } else {
      debug(`prisma.${clientMethod}(${queryString})`)
    }

    return { query: queryString, parameters }
  }
