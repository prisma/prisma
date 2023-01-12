import * as PG from 'pg'

import type { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'postgresql',
  datasource: {
    url: (ctx) => getConnectionString(ctx),
  },
  async connect(ctx) {
    const connectionString = getConnectionString(ctx)
    const db = new PG.Client({ connectionString })
    await db.connect()
    return db
  },
  beforeEach: async (db, sqlScenario, ctx) => {
    const sqlUp = `
    drop schema if exists ${ctx.id} cascade;
    create schema ${ctx.id};
    set search_path to ${ctx.id};`
    await db.query(sqlUp + sqlScenario)
    await db.end()
  },
  close: (db) => db.end(),
} as Input<PG.Client>['database']

function getConnectionString(ctx: Context) {
  const serviceConnectionString = process.env.TEST_POSTGRES_BASE_URI || 'postgres://prisma:prisma@localhost:5432'
  const connectionString = `${serviceConnectionString}/tests?schema=${ctx.id}&connection_limit=1`
  return connectionString
}
