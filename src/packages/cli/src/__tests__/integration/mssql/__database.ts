import mssql from 'mssql'
import url from 'url'

import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlserver',
  datasource: {
    url: ctx =>
      `sqlserver://localhost:1433;database=master_tests;user=SA;password=Prisma1-prisma;trustServerCertificate=true;encrypt=DANGER_PLAINTEXT`,
  },
  connect(ctx) {
    const credentials = getConnectionInfo(ctx).credentials
    return mssql.connect({
      user: credentials.user,
      password: credentials.password,
      server: credentials.server,
      database: ctx.step === 'scenario' ? `master_tests` : `master`,
    })
  },
  send: (db, sql) => db.query(sql),
  close: db => db.close(),
  up: ctx =>
    `
        USE master;
        DROP DATABASE IF EXISTS "master_tests";
        CREATE DATABASE "master_tests";
   `,
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
