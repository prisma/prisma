import * as PG from 'pg'
import { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'postgresql',
  datasource: {
    url: (ctx) => getConnectionString(ctx),
  },
  async connect(ctx) {
    const connectionString = getConnectionString(ctx)
    const db = new PG.Client({ connectionString })
    await new Promise((res, rej) =>
      db.connect((err) => (err ? rej(err) : res())),
    )
    return db
  },
  send: (db, sql) => db.query(sql),
  close: (db) => db.end(),
  up: (ctx) => {
    return `
      drop schema if exists ${ctx.id} cascade;
      create schema ${ctx.id};
      set search_path to ${ctx.id};
    `
  },
} as Input<PG.Client>['database']

function getConnectionString(ctx: Context) {
  const serviceConnectionString =
    process.env.TEST_POSTGRES_URI ||
    'postgres://prisma:prisma@localhost:5432/postgres'
  const connectionString = `${serviceConnectionString}?schema=${ctx.id}`
  return connectionString
}
