import { uriToCredentials } from '@prisma/sdk'
import mariadb from 'mariadb'
import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'vitess57',
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
  const serviceConnectionString =
    process.env.TEST_VITESS57_URI || 'mysql://root:prisma@localhost:33577/test'
  const connectionString = `${serviceConnectionString}/${ctx.id}`
  const credentials = uriToCredentials(connectionString)

  return {
    credentials,
    connectionString,
  }
}
