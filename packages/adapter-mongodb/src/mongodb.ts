/* eslint-disable @typescript-eslint/require-await */

import type {
  ConnectionInfo,
  MongoDBDriverAdapter,
  MongoDBQuery,
  MongoDBResultSet,
  Queryable,
  Result,
  Transaction,
  TransactionContext,
} from '@prisma/driver-adapter-utils'
import { Debug, ok } from '@prisma/driver-adapter-utils'
import { ClientSession, MongoClient } from 'mongodb'
import { Promise } from 'ts-toolbelt/out/Any/Promise'

import { name as packageName } from '../package.json'

const debug = Debug('prisma:driver-adapter:mongodb')

class MongoDBQueryable implements Queryable<MongoDBQuery> {
  readonly provider = 'mongodb'
  readonly adapterName = packageName

  constructor(protected readonly client: MongoClient, protected readonly database: string) {}

  async queryRaw(query: MongoDBQuery): Promise<Result<MongoDBResultSet>> {
    const result = await this.runQuery(query)
    if (query.returnType === 'cursor') {
      return ok({
        kind: 'mongodb',
        // Because toArray() is async to operate over the full cursor, we need to await it before returning the result!
        rows: await result.toArray(),
      })
    } else {
      return ok({ kind: 'mongodb', rows: [result] })
    }
  }

  async executeRaw(query: MongoDBQuery): Promise<Result<number>> {
    const result = await this.runQuery(query)
    const numberAffectedRows = (result.insertedCount || 0) + (result.modifiedCount || 0) + (result.deletedCount || 0)
    return ok(numberAffectedRows)
  }

  private async runQuery(query: MongoDBQuery) {
    // MongoDB uses positional arguments and different methods have different params.
    // With this `filter` we ensure to filter out not provided ones.
    const args = [query.query, query.data, query.options].filter(Boolean)
    const collection = this.client.db(this.database).collection(query.collection)
    return await (collection[query.action] as any)(...args)
  }
}

class MongoDBTransaction extends MongoDBQueryable implements Transaction<MongoDBQuery> {
  readonly options = { usePhantomQuery: true }

  constructor(client: MongoClient, database: string, private readonly session: ClientSession) {
    super(client, database)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    await this.session.commitTransaction()
    return ok(undefined)
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    await this.session.abortTransaction()
    return ok(undefined)
  }

  async queryRaw(query: MongoDBQuery): Promise<Result<MongoDBResultSet>> {
    return super.queryRaw({ ...query, options: { ...query.options, session: this.session } })
  }

  async executeRaw(query: MongoDBQuery): Promise<Result<number>> {
    return super.executeRaw({ ...query, options: { ...query.options, session: this.session } })
  }
}

class MongoDBTransactionContext extends MongoDBQueryable implements TransactionContext<MongoDBQuery> {
  constructor(client: MongoClient, database: string) {
    super(client, database)
  }

  async startTransaction(): Promise<Result<Transaction<MongoDBQuery>>> {
    const session = this.client.startSession()
    return ok(new MongoDBTransaction(this.client, this.database, session))
  }
}

export type PrismaMongoDbOptions = {
  client: MongoClient
  database?: string
}

export class PrismaMongoDB extends MongoDBQueryable implements MongoDBDriverAdapter {
  constructor(readonly options: PrismaMongoDbOptions) {
    super(options.client, options?.database || 'test')
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: this.options?.database,
    })
  }

  async transactionContext(): Promise<Result<TransactionContext<MongoDBQuery>>> {
    return ok(new MongoDBTransactionContext(this.client, this.database))
  }

  async executeRawCommand(command: Record<string, unknown>): Promise<Result<Record<string, unknown>>> {
    const result = await this.client.db(this.database).command(command)
    return ok(result)
  }
}
