/* eslint-disable */

import { setTimeout } from 'node:timers/promises'
import type { Driver, Closeable, ResultSet, Query } from '../types/Library'
import { binder } from './utils/binder'

type TimeoutConfig = {
  ms: number
}

class PrismaTimeout implements Driver, Closeable {
  private maybeVersion?: 'timeout'
  private isRunning: boolean = true

  constructor(private config: TimeoutConfig) {
  }

  async close(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false
    }
  }

  /**
   * Returns false, if connection is considered to not be in a working state.
   */
  isHealthy(): boolean {
    const result = this.maybeVersion !== undefined
      && this.isRunning
    return result
  }
  
  /**
   * Execute a query given as SQL, interpolating the given parameters.
   */
  async queryRaw(query: Query): Promise<ResultSet> {
    await setTimeout(this.config.ms)

    const resultSet: ResultSet = {
      columnNames: [],
      columnTypes: [],
      rows: [],
    }

    return resultSet
  }

  /**
   * Execute a query given as SQL, interpolating the given parameters and
   * returning the number of affected rows.
   * Note: Queryable expects a u64, but napi.rs only supports u32.
   */
  async executeRaw(query: Query): Promise<number> {
    await setTimeout(this.config.ms)
    return 0
  }

  /**
   * Return the version of the underlying database, queried directly from the
   * source. This corresponds to the `version()` function on PostgreSQL for
   * example. The version string is returned directly without any form of
   * parsing or normalization.
   */
  version(): Promise<string | undefined> {
    return Promise.resolve(this.maybeVersion)
  }
}

export const createTimeoutDriver = (config: TimeoutConfig): Driver & Closeable => {
  const db = new PrismaTimeout(config)
  return binder(db)
}
