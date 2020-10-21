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
  clientConnect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    const credentialsClone = { ...credentials }
    credentialsClone.database = `master_${ctx.id}`
    console.log({ credentialsClone })
    return sql.connect(credentialsClone)
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
  const connectionString = `${serviceConnectionString}_${ctx.id}`
  const credentials = {
    user: 'SA',
    password: 'Prisma1-prisma',
    server: connectionUrl.hostname,
    database: `master`,
  }
  return { credentials, connectionString }
}
