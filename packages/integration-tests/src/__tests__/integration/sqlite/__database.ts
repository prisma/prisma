import { Database } from 'sqlite-async'

import type { Input } from '../../__helpers__/integrationTest'

export const database = {
  name: 'sqlite',
  datasource: {
    url: (ctx) => `file:${ctx.fs.path()}/sqlite.db`,
  },
  connect: (ctx) => Database.open(`${ctx.fs.path()}/sqlite.db`),
  beforeEach: (db, sqlScenario) => db.exec(sqlScenario),
  afterEach: (client) => client.close(),
} as Input<any>['database']
