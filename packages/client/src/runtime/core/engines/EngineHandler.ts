import { ClientEngineType } from '@prisma/internals'

import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { resolveDatasourceUrl } from '../init/resolveDatasourceUrl'
import { Metrics } from '../metrics/MetricsClient'
import { BinaryEngine } from './binary/BinaryEngine'
import {
  BatchQueryEngineResult,
  Engine,
  EngineConfig,
  EngineEventType,
  RequestBatchOptions,
  RequestOptions,
} from './common/Engine'
import { JsonQuery } from './common/types/JsonProtocol'
import { MetricsOptionsJson, MetricsOptionsPrometheus } from './common/types/Metrics'
import { QueryEngineResult } from './common/types/QueryEngine'
import { InteractiveTransactionInfo, Options, TransactionHeaders } from './common/types/Transaction'
import { DataProxyEngine } from './data-proxy/DataProxyEngine'
import { LibraryEngine } from './library/LibraryEngine'

/**
 * A wrapper around the different engine flavors that decides which engine
 * should be loaded. Additionally, it also has the purpose of deferring the
 * engine instantiation until it is actually used. This is necessary because the
 * engine instantiation depends the URL, which also needs to be resolved and
 * validated but is not allowed to error when PrismaClient is instantiated.
 */
export class EngineHandler extends Engine {
  _engineFlavor: Engine | undefined
  _engineConfig: EngineConfig

  constructor(engineConfig: EngineConfig) {
    super()
    this._engineConfig = engineConfig
  }

  _getEngine(): Engine {
    if (this._engineFlavor !== undefined) {
      return this._engineFlavor
    }

    const url = resolveDatasourceUrl({
      inlineDatasources: this._engineConfig.inlineDatasources,
      overrideDatasources: this._engineConfig.overrideDatasources,
      env: { ...this._engineConfig.env, ...process.env },
      clientVersion: this._engineConfig.clientVersion,
    })

    if (url.startsWith('prisma://')) {
      return (this._engineFlavor = new DataProxyEngine(this._engineConfig))
    } else if (this._engineConfig.engineType === ClientEngineType.Library && TARGET_ENGINE_TYPE === 'library') {
      return (this._engineFlavor = new LibraryEngine(this._engineConfig))
    } else if (this._engineConfig.engineType === ClientEngineType.Binary && TARGET_ENGINE_TYPE === 'binary') {
      return (this._engineFlavor = new BinaryEngine(this._engineConfig))
    }

    throw new PrismaClientValidationError('Invalid client engine type, please use `library` or `binary`', {
      clientVersion: this._engineConfig.clientVersion,
    })
  }

  on(event: EngineEventType, listener: (args?: any) => any): void {
    this._getEngine().on(event, listener)
  }
  start(): Promise<void> {
    return this._getEngine().start()
  }
  async stop(): Promise<void> {
    await this._engineFlavor?.stop()
  }
  version(forceRun?: boolean | undefined): string | Promise<string> {
    return this._getEngine().version(forceRun)
  }
  request<T>(query: JsonQuery, options: RequestOptions<unknown>): Promise<QueryEngineResult<T>> {
    return this._getEngine().request(query, options)
  }
  requestBatch<T>(queries: JsonQuery[], options: RequestBatchOptions<unknown>): Promise<BatchQueryEngineResult<T>[]> {
    return this._getEngine().requestBatch(queries, options)
  }
  transaction(
    action: 'start',
    headers: TransactionHeaders,
    options?: Options | undefined,
  ): Promise<InteractiveTransactionInfo<unknown>>
  transaction(action: 'commit', headers: TransactionHeaders, info: InteractiveTransactionInfo<unknown>): Promise<void>
  transaction(action: 'rollback', headers: TransactionHeaders, info: InteractiveTransactionInfo<unknown>): Promise<void>
  transaction(
    action: unknown,
    headers: unknown,
    info?: unknown,
  ): Promise<void> | Promise<InteractiveTransactionInfo<unknown>> {
    return this._getEngine().transaction(action as any, headers as any, info as any)
  }
  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(options: unknown): Promise<string> | Promise<Metrics> {
    return this._getEngine().metrics(options as any)
  }
}
