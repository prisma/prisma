const sql = require('mssql')
const url = require('url')

import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlserver',
  datasource: {
    url: ctx => getConnectionInfo(ctx).connectionString,
  },
  connect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return sql.connect({
      user: credentials.user,
      password: credentials.password,
      server: credentials.server,
      database: ctx.step === 'scenario' ? `master_${ctx.id}` : `master`,
    })
  },
  send: (db, sql) => db.query(sql),
  close: db => db.close(),
  up: ctx => {
    return `
    IF EXISTS (SELECT * FROM SysDatabases WHERE NAME='master_${ctx.id}')
      DROP DATABASE master_${ctx.id};
    CREATE DATABASE master_${ctx.id};`
  },
} as Input['database']

function getConnectionInfo(ctx: Context) {
  const { URL } = url
  const serviceConnectionString =
    process.env.TEST_MSSQL_URI ||
    'sqlserver://SA:Prisma1-prisma@localhost:1433/master'
  const connectionUrl = new URL(serviceConnectionString)
  const connectionString = `sqlserver://${connectionUrl.host};database=master_${ctx.id};user=SA;password=Prisma1-prisma;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT`
  const credentials = {
    user: 'SA',
    password: 'Prisma1-prisma',
    server: connectionUrl.hostname,
    database: `master`,
  }
  return { credentials, connectionString }
}
