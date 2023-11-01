import * as PG from 'pg'

import type { Context, Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'postgresql',
  datasource: {
    url: process.env.TEST_POSTGRES_URI,
  },
  async connect() {
    const connectionString = process.env.TEST_POSTGRES_URI
    const db = new PG.Client({ connectionString })
    await db.connect()
    return db
  },
  beforeEach: async (db, sqlScenario, ctx: Context) => {
    const sqlUp = `
    drop schema if exists ${ctx.id} cascade;
    create schema ${ctx.id};
    set search_path to ${ctx.id};`
    await db.query(sqlUp + sqlScenario)
    await db.end()
  },
  close: (db) => db.end(),
} as Input<PG.Client>['database']
