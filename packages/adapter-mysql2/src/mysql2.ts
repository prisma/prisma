/* eslint-disable @typescript-eslint/require-await */
import type {
  DriverAdapter,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { Debug, err, ok } from '@prisma/driver-adapter-utils'
import type mysql from 'mysql2/promise'

const debug = Debug('prisma:driver-adapter:mysql2')

type StdClient = any
type TransactionClient = any

/**
 * TODO
 */
class MySQL2Queryable<ClientT extends StdClient | TransactionClient> implements Queryable {
  readonly flavour = 'mysql'

  constructor(protected readonly client: ClientT) {}

  async queryRaw(params: Query): Promise<Result<ResultSet>> {
    throw new Error('Method not implemented.')
  }

  async executeRaw(params: Query): Promise<Result<number>> {
    throw new Error('Method not implemented.')
  }
}

/**
 * TODO
 */
class MySQL2Transaction extends MySQL2Queryable<TransactionClient> implements Transaction {
  constructor(client: StdClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<Result<void>> {
    throw new Error('Method not implemented.')
  }

  async rollback(): Promise<Result<void>> {
    throw new Error('Method not implemented.')
  }

  dispose(): Result<void> {
    throw new Error('Method not implemented.')
  }
}

/**
 * TODO
 */
export class PrismaMySQL2 extends MySQL2Queryable<StdClient> implements DriverAdapter {
  constructor(client: StdClient) {
    super(client)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    throw new Error('Method not implemented.')
  }

  async close(): Promise<Result<void>> {
    throw new Error('Method not implemented.')
  }
}
