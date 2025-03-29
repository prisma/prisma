import { type Client, type Config, createClient } from '@libsql/client'

import { PrismaLibSQLAdapterFactoryBase } from './libsql'

export class PrismaLibSQLAdapterFactory extends PrismaLibSQLAdapterFactoryBase {
  createClient(config: Config): Client {
    return createClient(config)
  }
}
