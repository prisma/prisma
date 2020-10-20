const sql = require('mssql')
import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'mssql',
  datasource: {
    url: (ctx) => getConnectionInfo(ctx).connectionString,
  },
  connect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return sql.connect(credentials)
  },
  send: (db, sql) => db.query(sql),
  close: (db) => db.end(),
  up: (ctx) => {
    return `
        DROP DATABASE IF EXISTS ${ctx.id};
        CREATE DATABASE ${ctx.id};
        USE ${ctx.id};
        `
  },
} as Input['database']

function getConnectionInfo(ctx: Context) {
  const serviceConnectionString = process.env.TEST_MSSQL_URI || 'sqlserver://SA:Prisma1-prisma@localhost:1433/master'
  const connectionString = `${serviceConnectionString}-${ctx.id}`
  const credentials = {
    user: 'SA',
    password: 'Prisma1-prisma',
    server: 'localhost',
    database: `master-${ctx.id}`,
  }
  return { credentials, connectionString }
}
