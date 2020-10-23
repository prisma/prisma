const sql = require('mssql')
const url = require('url')

import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlserver',
  datasource: {
    url: ctx => getConnectionInfo(ctx).connectionString,
  },
  connect: ctx => {
    const credentials = getConnectionInfo(ctx).credentials
    const pool = new sql.ConnectionPool({
      user: credentials.user,
      password: credentials.password,
      server: credentials.server,
      database: ctx.step === 'scenario' ? `master_${ctx.id}` : `master`,
      pool: {
        max: 1,
      },
      options: {
        enableArithAbort: false,
      },
    })
    return pool.connect()
  },
  send: (pool, sql) => pool.request().query(sql),
  close: pool => pool.close(),
  up: ctx => {
    return `
    DROP DATABASE IF EXISTS master_${ctx.id};
    CREATE DATABASE master_${ctx.id};`
  },
} as Input['database']

function getConnectionInfo(ctx: Context) {
  const { URL } = url
  const serviceConnectionString =
    process.env.TEST_MSSQL_URI ||
    'mssql://SA:Pr1sm4_Pr1sm4@localhost:1433/master'
  const connectionUrl = new URL(serviceConnectionString)
  const connectionString = `sqlserver://${connectionUrl.host};database=master_${ctx.id};user=SA;password=Pr1sm4_Pr1sm4;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT`
  const credentials = {
    user: 'SA',
    password: 'Pr1sm4_Pr1sm4',
    server: connectionUrl.hostname,
    port: connectionUrl.port,
    database: `master`,
  }
  return { credentials, connectionString }
}
