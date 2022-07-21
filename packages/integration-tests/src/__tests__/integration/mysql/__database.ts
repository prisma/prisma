import { uriToCredentials } from '@prisma/internals'
import mariadb from 'mariadb'

import type { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'mysql',
  datasource: {
    url: (ctx) => getConnectionInfo(ctx).connectionString,
  },
  connect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return mariadb.createConnection({
      host: credentials.host,
      port: credentials.port,
      user: credentials.user,
      password: credentials.password,
      multipleStatements: true,
      allowPublicKeyRetrieval: true,
    })
  },
  beforeEach: async (db, sqlScenario, ctx) => {
    const sqlUp = `
    DROP DATABASE IF EXISTS ${ctx.id};
    CREATE DATABASE ${ctx.id};
    USE ${ctx.id};`
    await db.query(sqlUp + sqlScenario)
  },
  close: (db) => db.end(),
} as Input<mariadb.Connection>['database']

function getConnectionInfo(ctx: Context) {
  const serviceConnectionString = process.env.TEST_MYSQL_BASE_URI || 'mysql://root:root@localhost:3306'
  const connectionString = `${serviceConnectionString}/${ctx.id}`
  const credentials = uriToCredentials(connectionString)

  return {
    credentials,
    connectionString,
  }
}
