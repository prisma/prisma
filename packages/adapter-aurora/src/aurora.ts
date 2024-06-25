import {
  BeginTransactionCommand,
  BeginTransactionCommandInput,
  CommitTransactionCommand,
  CommitTransactionCommandInput,
  ExecuteStatementCommand,
  ExecuteStatementCommandInput,
  ExecuteStatementResponse,
  RDSDataClient,
  RollbackTransactionCommand,
  RollbackTransactionCommandInput,
} from '@aws-sdk/client-rds-data'
import {
  ConnectionInfo,
  Debug,
  DriverAdapter,
  err,
  ok,
  Query,
  Queryable,
  Result,
  ResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'

import { name as packageName } from '../package.json'

const debug = Debug('prisma:driver-adapter:aurora')

interface AuroraQueryParams {
  readonly resourceArn: string
  readonly secretArn: string
  readonly databaseName: string
}

class AuroraQueryable<ClientT extends RDSDataClient> implements Queryable {
  readonly provider = 'postgres'
  readonly adapterName = packageName

  constructor(protected client: ClientT, protected queryParams: AuroraQueryParams, protected transactionId?: string) {}

  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<Result<ResultSet>> {
    const tag = '[js::query_raw]'
    debug(`${tag} %O`, query)

    const res = await this.performIO(query)

    if (!res.ok) {
      return err(res.error)
    }

    return res.map((result) => {
      const columnNames = result.columnMetadata ? result.columnMetadata?.map((column) => column.name ?? '') : []
      const columnTypes = result.columnMetadata ? result.columnMetadata?.map((column) => column.typeName ?? '') : [] //TODO: This likely needs some conversion
      const rows = result.records ?? [] //TODO: review if this is the correct type. I see the other adapters not marshalling the result data but I don't understand how? Perhaps planetscale and neon have the same result structure?
      return {
        columnNames: columnNames,
        columnTypes: columnTypes as any,
        rows,
      }
    })
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<Result<number>> {
    const tag = '[js::execute_raw]'
    debug(`${tag} %O`, query)

    return (await this.performIO(query)).map((r) => r.numberOfRecordsUpdated ?? 0)
  }

  /**
   * Run a query against the database, returning the result set.
   * Should the query fail due to a connection error, the connection is
   * marked as unhealthy.
   */
  private async performIO(query: Query): Promise<Result<ExecuteStatementResponse>> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sql, args: values } = query //TODO: I think I need to convert these values to RDS Data API SQLParameters type

    const queryParams: ExecuteStatementCommandInput = {
      database: this.queryParams.databaseName,
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      sql,
      // parameters: values,
      includeResultMetadata: true,
      transactionId: this.transactionId,
    }

    const executeStatementCommand = new ExecuteStatementCommand(queryParams)
    try {
      const result = await this.client.send(executeStatementCommand)
      return ok(result)
    } catch (e) {
      //TODO: Do better error handling
      const error = e as Error
      debug('Error in performIO: %O', error)
      throw error
    }
  }
}

class AuroraTransaction extends AuroraQueryable<RDSDataClient> implements Transaction {
  constructor(
    client: RDSDataClient,
    queryParams: AuroraQueryParams,
    transactionId: string,
    readonly options: TransactionOptions,
  ) {
    super(client, queryParams, transactionId)
  }

  async commit(): Promise<Result<void>> {
    debug(`[js::commit]`)

    const queryParams: CommitTransactionCommandInput = {
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      transactionId: this.transactionId,
    }

    const commitTransactionCommand = new CommitTransactionCommand(queryParams)
    await this.client.send(commitTransactionCommand)
    return Promise.resolve(ok(undefined))
  }

  async rollback(): Promise<Result<void>> {
    debug(`[js::rollback]`)

    const queryParams: RollbackTransactionCommandInput = {
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
      transactionId: this.transactionId,
    }

    const rollbackTransactionCommand = new RollbackTransactionCommand(queryParams)
    await this.client.send(rollbackTransactionCommand)
    return Promise.resolve(ok(undefined))
  }
}

export class PrismaAurora extends AuroraQueryable<RDSDataClient> implements DriverAdapter {
  constructor(client: RDSDataClient, queryParams: AuroraQueryParams) {
    if (!(client instanceof RDSDataClient)) {
      throw new TypeError(`PrismaAurora must be initialized with an instance of Client:
  import { RDSDataClient } from "@aws-sdk/client-rds-data"
  const client = new RDSDataClient({ region: env.AWS_REGION });
  const adapter = new PrismaAurora(client)
  `)
    }
    super(client, queryParams)
  }

  async startTransaction(): Promise<Result<Transaction>> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tag = '[js::startTransaction]'
    debug(`${tag} options: %O`, options)

    const beginTransactionCommandInput: BeginTransactionCommandInput = {
      database: this.queryParams.databaseName,
      resourceArn: this.queryParams.resourceArn,
      secretArn: this.queryParams.secretArn,
    }

    const command = new BeginTransactionCommand(beginTransactionCommandInput)
    const beginTransactionResponse = await this.client.send(command)

    if (!beginTransactionResponse.transactionId) {
      throw new Error(`Unable to create transaction`)
    }
    debug(`${tag} transaction created: %O`, beginTransactionResponse.transactionId)

    return ok(new AuroraTransaction(this.client, this.queryParams, beginTransactionResponse.transactionId, options))
  }

  getConnectionInfo(): Result<ConnectionInfo> {
    return ok({
      schemaName: this.queryParams.databaseName,
    })
  }
}
