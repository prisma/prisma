import { uriToCredentials } from '@prisma/sdk'
import mariadb from 'mariadb'
import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'vitess80',
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
      ssl: credentials.ssl,
      allowPublicKeyRetrieval: true,
      multipleStatements: true,
    })
  },
  beforeEach: async (db, sqlScenario, ctx) => {
    // const sqlUp = `
    // DROP DATABASE IF EXISTS ${ctx.id};
    // CREATE DATABASE ${ctx.id};
    // USE ${ctx.id};`
    // await db.query(sqlUp + sqlScenario)
    await db.query('USE test')
    const foreign_keys = await db.query({
      rowsAsArray: true,
      sql:
        'SELECT DISTINCT TABLE_NAME, CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_NAME IS NOT NULL',
    })
    for (const row of foreign_keys) {
      await db.query(
        'ALTER TABLE `' + row[0] + '` DROP FOREIGN KEY `' + row[1] + '`',
      )
    }
    const tables = await db.query({ rowsAsArray: true, sql: 'SHOW TABLES' })
    for (const row of tables) {
      await db.query('DROP TABLE `' + row[0] + '`')
    }
    await db.query(sqlScenario)
  },
  close: (db) => db.end(),
} as Input<mariadb.Connection>['database']

function getConnectionInfo(ctx: Context) {
  const connectionString =
    process.env.TEST_VITESS80_URI || 'mysql://root:prisma@localhost:33807/test'
  const credentials = uriToCredentials(connectionString)

  return {
    credentials,
    connectionString,
  }
}
