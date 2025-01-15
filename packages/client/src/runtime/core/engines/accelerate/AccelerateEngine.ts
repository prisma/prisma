/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { BatchQueryEngineResult, Engine, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import { JsonQuery } from '../common/types/JsonProtocol'
import { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import { QueryEngineResultData } from '../common/types/QueryEngine'
import { InteractiveTransactionInfo as ITXInfo, Options, TransactionHeaders } from '../common/types/Transaction'

const ERROR_MESSAGE = `Accelerate has not been setup correctly. Make sure your client is using \`.$extends(withAccelerate())\`. See https://pris.ly/d/accelerate-getting-started`

export type AccelerateEngineConfig = {
  inlineSchema: EngineConfig['inlineSchema']
  inlineSchemaHash: EngineConfig['inlineSchemaHash']
  env: EngineConfig['env']
  generator?: { previewFeatures: string[] }
  inlineDatasources: EngineConfig['inlineDatasources']
  overrideDatasources: EngineConfig['overrideDatasources']
  clientVersion: EngineConfig['clientVersion']
  engineVersion: EngineConfig['engineVersion']
  logEmitter: EngineConfig['logEmitter']
  logQueries?: EngineConfig['logQueries']
  logLevel?: EngineConfig['logLevel']
  tracingHelper: EngineConfig['tracingHelper']
  accelerateUtils?: EngineConfig['accelerateUtils']
}

/**
 * This is an empty implementation of the AccelerateEngine.
 * It is used when the user has not setup Accelerate correctly.
 */
export class AccelerateEngine implements Engine<any> {
  name = 'AccelerateEngine' as const

  constructor(public config: AccelerateEngineConfig) {}

  onBeforeExit(_callback: () => Promise<void>): void {}
  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  version(_forceRun?: boolean): Promise<string> | string {
    return 'unknown'
  }

  transaction(action: 'start', headers: TransactionHeaders, options?: Options): Promise<ITXInfo>
  transaction(action: 'commit', headers: TransactionHeaders, info: ITXInfo): Promise<void>
  transaction(action: 'rollback', headers: TransactionHeaders, info: ITXInfo): Promise<void>
  transaction(_action: unknown, _headers: unknown, _info?: unknown): Promise<void | ITXInfo> {
    throw new PrismaClientInitializationError(ERROR_MESSAGE, this.config.clientVersion)
  }

  metrics(options: MetricsOptionsJson): Promise<Metrics>
  metrics(options: MetricsOptionsPrometheus): Promise<string>
  metrics(_options: unknown): Promise<string | Metrics> {
    throw new PrismaClientInitializationError(ERROR_MESSAGE, this.config.clientVersion)
  }

  request<T>(_query: JsonQuery, _options: RequestOptions<unknown>): Promise<QueryEngineResultData<T>> {
    throw new PrismaClientInitializationError(ERROR_MESSAGE, this.config.clientVersion)
  }

  requestBatch<T>(_queries: JsonQuery[], _options: RequestBatchOptions<unknown>): Promise<BatchQueryEngineResult<T>[]> {
    throw new PrismaClientInitializationError(ERROR_MESSAGE, this.config.clientVersion)
  }

  /** Additional utilities that are trampolined from the received config */
  resolveDatasourceUrl = this.config.accelerateUtils?.resolveDatasourceUrl!
  getBatchRequestPayload = this.config.accelerateUtils?.getBatchRequestPayload
  prismaGraphQLToJSError = this.config.accelerateUtils?.prismaGraphQLToJSError!
  PrismaClientUnknownRequestError = this.config.accelerateUtils?.PrismaClientUnknownRequestError!
  PrismaClientInitializationError = this.config.accelerateUtils?.PrismaClientInitializationError!
  PrismaClientKnownRequestError = this.config.accelerateUtils?.PrismaClientKnownRequestError!
  debug = this.config.accelerateUtils?.debug!
  engineVersion = this.config.accelerateUtils?.engineVersion!
  clientVersion = this.config.accelerateUtils?.clientVersion!

  applyPendingMigrations(): Promise<void> {
    throw new PrismaClientInitializationError(ERROR_MESSAGE, this.config.clientVersion)
  }
}

export type {
  BatchQueryEngineResult,
  Engine,
  EngineConfig,
  InteractiveTransactionOptions,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
export type { LogEmitter } from '../common/types/Events'
export type { JsonQuery } from '../common/types/JsonProtocol'
export type { Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
export type { QueryEngineBatchResult } from '../common/types/QueryEngine'
export type { QueryEngineResultData } from '../common/types/QueryEngine'
export type { InteractiveTransactionInfo, Options, TransactionHeaders } from '../common/types/Transaction'
export type { LogLevel } from '../common/utils/log'
export type { EngineSpan, TracingHelper } from '@prisma/internals'
