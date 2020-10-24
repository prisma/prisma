import Database from 'sqlite-async'
import { Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlite',
  datasource: {
    url: (ctx) => `file:${ctx.fs.path()}/sqlite.db`,
  },
  connect: (ctx) => Database.open(`${ctx.fs.path()}/sqlite.db`),
  send: (ctx, db, sql) => db.exec(sql),
  afterEach: (client) => client.close(),
} as Input<any>['database']
