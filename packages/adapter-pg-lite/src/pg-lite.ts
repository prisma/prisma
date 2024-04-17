/* eslint-disable @typescript-eslint/require-await */
import { PGlite } from '@electric-sql/pglite'
import type {
  ColumnType,
  ConnectionInfo,
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'

const debug = Debug('prisma:driver-adapter:pglite')

class PgLiteQueryable<ClientT extends PGlite> implements Queryable {
  readonly provider = 'pglite'
  readonly adapterName = packageName

  constructor(protected readonly client: ClientT) {}

  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const res = await this.performIO(query)

    if (!res.ok) {
      return err(res.error)
    }

    const { fields, rows } = res.value
    const columnNames = fields.map((field) => field.name)
    const columnTypes: ColumnType[] = fields.map((field) => field.dataTypeID as ColumnType)

    return ok({
      columnNames,
      columnTypes,
      rows,
    })
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).map(({ affectedRows }) => affectedRows ?? 0)
  }

  private async performIO(query: Query): Promise<Result<any>> {
    const { sql, args: values } = query

    try {
      const result = await this.client.query(sql, values, {
        rowMode: 'array',
      })
      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      if (e && typeof e.code === 'string' && typeof e.severity === 'string' && typeof e.message === 'string') {
        return err({
          kind: 'Postgres',
          code: e.code,
          severity: e.severity,
          message: e.message,
          detail: e.detail,
          column: e.column,
          hint: e.hint,
        })
      }
      throw error
    }
  }
}

class PgLiteTransaction extends PgLiteQueryable<PGlite> implements Transaction {
  constructor(client: PGlite, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)
    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)
    return ok(undefined)
  }
}

export type PrismaPgLiteOptions = {
  schema?: string
}

export class PrismaPgLite extends PgLiteQueryable<PGlite> implements DriverAdapter {
  constructor(client: PGlite, private options?: PrismaPgLiteOptions) {
    if (!(client instanceof PGlite)) {
      throw new TypeError(`PrismaPgLite must be initialized with an instance of PGlite`)
    }
    super(client)
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: this.options?.schema,
    })
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: false,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    return ok(new PgLiteTransaction(this.client, options))
  }
}
