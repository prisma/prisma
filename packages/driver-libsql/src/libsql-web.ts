import { type Client, type Config, createClient } from '@libsql/client/web'

import { PrismaLibSqlDriverFactoryBase } from './libsql'

export class PrismaLibSqlWebDriverFactory extends PrismaLibSqlDriverFactoryBase {
  createClient(config: Config): Client {
    return createClient(config)
  }
}
