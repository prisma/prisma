import Database from 'sqlite-async'
import { Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlite',
  datasource: {
    url: (ctx) => `file:${ctx.fs.path()}/sqlite.db`,
  },
  connect: (ctx) => Database.open(`${ctx.fs.path()}/sqlite.db`),
  send: (db, sqlDatabase, sqlScenario, ctx) => db.exec(sqlDatabase + sqlScenario),
  afterEach: (client) => client.close(),
} as Input<any>['database']
