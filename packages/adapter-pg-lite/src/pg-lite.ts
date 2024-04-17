import { PgliteClient } from '@electric-sql/pglite'
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
import { fieldToColumnType, fixArrayBufferValues, UnsupportedNativeDataType } from './conversion'

const debug = Debug('prisma:driver-adapter:pglite')

class PgLiteQueryable<ClientT extends PgliteClient> implements Queryable {
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
    let columnTypes: ColumnType[] = []

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))
    } catch (e) {
      if (e instanceof UnsupportedNativeDataType) {
        return err({
          kind: 'UnsupportedNativeDataType',
          type: e.type,
        })
      }
      throw e
    }

    return ok({
      columnNames,
      columnTypes,
      rows,
    })
  }

  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).map(({ rowCount: rowsAffected }) => rowsAffected ?? 0)
  }

  private async performIO(query: Query): Promise<Result<any>> {
    const { sql, args: values } = query

    try {
      const result = await this.client.query(sql, fixArrayBufferValues(values))
      return ok(result)
    } catch (e) {
      const error = e as Error
      debug('Error in performIO: %O', error)
      if (e && typeof e.code === 'string' && typeof e.severity === 'string' && typeof e.message === 'string') {
        return err({
          kind: 'PgLite',
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

class PgLiteTransaction extends PgLiteQueryable<PgliteClient> implements Transaction {
  constructor(client: PgliteClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    await this.client.query('COMMIT')
    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    await this.client.query('ROLLBACK')
    return ok(undefined)
  }
}

export type PrismaPgLiteOptions = {
  schema?: string
}

export class PrismaPgLite extends PgLiteQueryable<PgliteClient> implements DriverAdapter {
  constructor(client: PgliteClient, private options?: PrismaPgLiteOptions) {
    if (!(client instanceof PgliteClient)) {
      throw new TypeError(`PrismaPgLite must be initialized with an instance of PgliteClient`)
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

    await this.client.query('BEGIN')
    return ok(new PgLiteTransaction(this.client, options))
  }
}
