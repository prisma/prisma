import { uriToCredentials } from '@prisma/internals'
import mariadb from 'mariadb'

import type { Context, Input } from '../../__helpers__/integrationTest'

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
  const serviceConnectionString = process.env.TEST_MARIADB_BASE_URI!
  const connectionString = `${serviceConnectionString}/${ctx.id}`
  const credentials = uriToCredentials(connectionString)

  return {
    credentials,
    connectionString,
  }
}
