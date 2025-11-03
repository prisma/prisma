import fs from 'node:fs'
import path from 'node:path'

import { D1Database } from '@cloudflare/workers-types'
import { SqlDriverAdapter, SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'
import { D1HttpParams, isD1HttpParams, PrismaD1HttpAdapterFactory } from './d1-http'
import { PrismaD1WorkerAdapterFactory } from './d1-worker'

// This is a wrapper type that can conform to either `SqlDriverAdapterFactory` or
// `SqlMigrationAwareDriverAdapterFactory`, depending on the type of the argument passed to the
// constructor. If the argument is of type `D1HttpParams`, it will leverage
// `PrismaD1HttpAdapterFactory`. Otherwise, it will use `PrismaD1WorkerAdapterFactory`.
export class PrismaD1<Args extends D1Database | D1HttpParams = D1Database> implements PrismaD1Interface<Args> {
  readonly provider = 'sqlite'
  readonly adapterName = packageName

  connect!: PrismaD1Interface<Args>['connect']
  connectToShadowDb!: PrismaD1Interface<Args>['connectToShadowDb']

  constructor(params: Args) {
    if (isD1HttpParams(params)) {
      const factory = new PrismaD1HttpAdapterFactory(params)
      const self = this as PrismaD1Interface<D1HttpParams>
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
  connectToShadowDb: Params extends D1HttpParams ? () => Promise<SqlDriverAdapter> : undefined
}

const localD1DatabasePath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject')

/**
 * Lists all local D1 databases found in the Wrangler state directory.
 *
 * This function scans the `.wrangler/state/v3/d1/miniflare-D1DatabaseObject` directory
 * for SQLite database files and returns their paths.
 *
 * @returns An array of file paths to local D1 database files
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@prisma/config'
 * import { listLocalDatabases } from '@prisma/adapter-d1'
 *
 * export default defineConfig({
 *   engine: 'classic',
 *   datasource: {
 *     url: `file://${listLocalDatabases().pop()}`,
 *   },
 * })
 * ```
 */
export function listLocalDatabases(): string[] {
  const cwd = process.cwd()
  const d1DirPath = path.join(cwd, localD1DatabasePath)
  const files = fs.readdirSync(d1DirPath)
  return files.filter((file) => file.endsWith('.sqlite')).map((file) => path.join(localD1DatabasePath, file))
}
