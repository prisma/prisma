import { uriToCredentials } from '@prisma/sdk'
import mariadb from 'mariadb'
import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'mariadb',
  datasource: {
    url: (ctx) => getConnectionInfo(ctx).connectionString,
    provider: 'mysql',
  },
  connect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return mariadb.createConnection({
      host: credentials.host,
      port: credentials.port,
      user: credentials.user,
      password: credentials.password,
      multipleStatements: true,
    })
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
} as Input<mariadb.Connection>['database']

function getConnectionInfo(ctx: Context) {
  const serviceConnectionString =
    process.env.TEST_MARIADB_BASE_URI || 'mysql://root:root@localhost:4306'
  const connectionString = `${serviceConnectionString}/${ctx.id}`
  const credentials = uriToCredentials(connectionString)

  return {
    credentials,
    connectionString,
  }
}
