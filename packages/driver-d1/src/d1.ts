import { D1Database } from '@cloudflare/workers-types'
import { SqlDriver, SqlDriverFactory } from '@prisma/driver-utils'

import { name as packageName } from '../package.json'
import { D1HttpParams, isD1HttpParams, PrismaD1HttpDriverFactory } from './d1-http'
import { PrismaD1WorkerDriverFactory } from './d1-worker'

// This is a wrapper type that can conform to either `SqlDriverFactory` or
// `SqlMigrationAwareDriverFactory`, depending on the type of the argument passed to the
// constructor. If the argument is of type `D1HttpParams`, it will leverage
// `PrismaD1HttpDriverFactory`. Otherwise, it will use `PrismaD1WorkerDriverFactory`.
export class PrismaD1<Args extends D1Database | D1HttpParams = D1Database> implements PrismaD1Interface<Args> {
  readonly provider = 'sqlite'
  readonly driverName = packageName

  connect!: PrismaD1Interface<Args>['connect']
  connectToShadowDb!: PrismaD1Interface<Args>['connectToShadowDb']

  constructor(params: Args) {
    if (isD1HttpParams(params)) {
      const factory = new PrismaD1HttpDriverFactory(params)
      const self = this as PrismaD1Interface<D1HttpParams>
      self.connect = factory.connect.bind(factory)
      self.connectToShadowDb = factory.connectToShadowDb.bind(factory)
    } else {
      const factory = new PrismaD1WorkerDriverFactory(params)
      const self = this as PrismaD1Interface<D1Database>
      self.connect = factory.connect.bind(factory)
    }
  }
}

type PrismaD1Interface<Params> = SqlDriverFactory & {
  connectToShadowDb: Params extends D1HttpParams ? () => Promise<SqlDriver> : undefined
}
