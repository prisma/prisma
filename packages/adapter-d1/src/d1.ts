import { D1Database } from '@cloudflare/workers-types'
import { SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'
import { D1HTTPParams, isD1HTTPParams, PrismaD1HTTPAdapterFactory } from './d1-http'
import { PrismaD1WorkerAdapterFactory } from './d1-worker'

// This is a wrapper type that can conform to either `SqlDriverAdapterFactory` or
// `SqlMigrationAwareDriverAdapterFactory`, depending on the type of the argument passed to the
// constructor. If the argument is of type `D1HTTPParams`, it will leverage
// `PrismaD1HTTPAdapterFactory`. Otherwise, it will use `PrismaD1WorkerAdapterFactory`.
export class PrismaD1<Args extends D1Database | D1HTTPParams = D1Database> implements PrismaD1Interface<Args> {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  connect!: PrismaD1Interface<Args>['connect']
  connectToShadowDb!: PrismaD1Interface<Args>['connectToShadowDb']

  constructor(params: Args) {
    if (isD1HTTPParams(params)) {
      const factory = new PrismaD1HTTPAdapterFactory(params)
      const self = this as PrismaD1Interface<D1HTTPParams>
      self.connect = factory.connect.bind(factory)
      self.connectToShadowDb = factory.connectToShadowDb.bind(factory)
    } else {
      const factory = new PrismaD1WorkerAdapterFactory(params)
      const self = this as PrismaD1Interface<D1Database>
      self.connect = factory.connect.bind(factory)
    }
  }
}

type PrismaD1Interface<Params> = SqlDriverAdapterFactory & {
  connectToShadowDb: Params extends D1HTTPParams ? () => Promise<SqlDriverAdapter> : undefined
}
