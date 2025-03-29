import { type Client, type Config, createClient } from '@libsql/client/web'

import { PrismaLibSQLAdapterFactoryBase } from './libsql'

export class PrismaLibSQLWebAdapterFactory extends PrismaLibSQLAdapterFactoryBase {
  createClient(config: Config): Client {
    return createClient(config)
  }
}
