/*
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 
  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at
 
  http://www.apache.org/licenses/LICENSE-2.0
 
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import type {
  ColumnType,
  ConnectionInfo,
  IsolationLevel,
  SqlDriverAdapter,
  SqlDriverAdapterFactory,
  SqlQuery,
  SqlQueryable,
  SqlResultSet,
  Transaction,
  TransactionOptions,
} from '@prisma/driver-adapter-utils'
import { DriverAdapterError } from '@prisma/driver-adapter-utils'
import { AwsPGClient } from 'aws-advanced-nodejs-wrapper/dist/pg/lib/index.js'
import pg from 'pg'

import { fieldToColumnType, UnsupportedNativeDataType } from './conversion'

class AwsQueryable<ClientT extends AwsPGClient> implements SqlQueryable {
  adapterName = 'aws'
  readonly provider = 'postgres'

  constructor(protected readonly client: ClientT) {}

  /**
   * Execute a query given as SQL.
   */
  async queryRaw(query: SqlQuery): Promise<SqlResultSet> {
    const { fields, rows } = await this.performIO(query)

    const columnNames = fields.map((field) => field.name)
    let columnTypes: ColumnType[] = []

    try {
      columnTypes = fields.map((field) => fieldToColumnType(field.dataTypeID))
    } catch (e) {
      if (e instanceof UnsupportedNativeDataType) {
        throw new DriverAdapterError({
          kind: 'UnsupportedNativeDataType',
          type: e.type,
        })
      }
      throw e
    }

    return {
      columnNames,
      columnTypes,
      rows,
    }
  }

  /**
   * Execute a query given as SQL, returning the number of returned rows.
   * Other adapters will return the number of affected rows, this can differ.
   */
  async executeRaw(query: SqlQuery): Promise<number> {
    return (await this.performIO(query)).rowCount ?? 0
  }

  /**
   * Run a query against the database, returning the result set.
   */

  private async performIO(query: SqlQuery): Promise<pg.QueryArrayResult<any>> {
    const { sql } = query
    // These terms will throw an error when passed to the client.
    return await this.client.query(sql.split('LIMIT')[0].split('OFFSET')[0])
  }
}

// The following are not fully implemented for desired behaviour.
class AwsTransaction extends AwsQueryable<AwsPGClient> implements Transaction {
  adapterName = 'aws'

  constructor(client: AwsPGClient, readonly options: TransactionOptions) {
    super(client)
  }

  async commit(): Promise<void> {}

  async rollback(): Promise<void> {
    await this.client.rollback()
  }
}

export type PrismaAwsOptions = {
  schema?: string
}

export class PrismaAws extends AwsQueryable<AwsPGClient> implements SqlDriverAdapter {
  adapterName = 'aws'

  constructor(client: AwsPGClient, private options?: PrismaAwsOptions) {
    if (!(client instanceof AwsPGClient)) {
      throw new TypeError('PrismaAws must be initialized with an AwsPgClient')
    }
    super(client)
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      schemaName: this.options?.schema,
    }
  }

  async executeScript(script: string): Promise<void> {
    // TODO: crude implementation for now, might need to refine it
    for (const stmt of script.split(';')) {
      await this.client.query(stmt)
    }
  }

  async dispose(): Promise<void> {
    return await this.client.end()
  }

  async startTransaction(isolationLevel?: IsolationLevel): Promise<Transaction> {
    const options: TransactionOptions = {
      usePhantomQuery: true,
    }

    const tx = new AwsTransaction(this.client, options)

    await tx.executeRaw({ sql: 'BEGIN', args: [], argTypes: [] })
    if (isolationLevel) {
      await tx.executeRaw({
        sql: `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
        args: [],
        argTypes: [],
      })
    }
    return tx
  }
}

export class PrismaAwsAdapterFactory implements SqlDriverAdapterFactory {
  readonly provider = 'postgres'
  readonly adapterName = 'aws'

  constructor(private readonly config: any, private readonly options?: PrismaAwsOptions) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async connect(): Promise<SqlDriverAdapter> {
    return new PrismaAws(new AwsPGClient(this.config), this.options)
  }
}
