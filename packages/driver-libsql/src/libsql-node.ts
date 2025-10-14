import { type Client, type Config, createClient } from '@libsql/client'

import { PrismaLibSqlDriverFactoryBase } from './libsql'

export class PrismaLibSqlDriverFactory extends PrismaLibSqlDriverFactoryBase {
  createClient(config: Config): Client {
    return createClient(config)
  }
}
