const sql = require('mssql')
const url = require('url');

import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlserver',
  datasource: {
    url: (ctx) => getConnectionInfo(ctx).connectionString,
  },
  connect (ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return sql.connect(credentials)
  },
  clientConnect(ctx) {
    sql.close()
    const credentials = getConnectionInfo(ctx).credentials
    const credentialsClone = {...credentials}
    credentialsClone.database = `master_${ctx.id}`
    return sql.connect(credentialsClone)
  },
  send: (db, sql) => db.query(sql),
  close: (db) => db.end(),
  up: (ctx) => {
    return `
    DROP DATABASE IF EXISTS master_${ctx.id};
    CREATE DATABASE master_${ctx.id};`
  },
} as Input['database']

function getConnectionInfo(ctx: Context) {
  const { URL } = url
  const serviceConnectionString = process.env.TEST_MSSQL_URI || 'sqlserver://SA:Prisma1-prisma@localhost:1433/master'
  const connectionUrl = new URL(serviceConnectionString)
  const connectionString = `sqlserver://localhost:1433;database=master_${ctx.id};user=SA;password=Prisma1-prisma;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT` 
  const credentials = {
    user: 'SA',
    password: 'Prisma1-prisma',
    server: connectionUrl.hostname,
    database: `master`, 
  }
  return { credentials, connectionString }
}
