import Debug from '@prisma/debug'
import type { ConnectorType } from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'
import { binaryTargets, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { byline, ClientEngineType, EngineSpanEvent, TracingHelper } from '@prisma/internals'
import type { ChildProcess, ChildProcessByStdio } from 'child_process'
import { spawn } from 'child_process'
import execa from 'execa'
import fs from 'fs'
import { blue, bold, green, red, yellow } from 'kleur/colors'
import pRetry from 'p-retry'
import type { Readable } from 'stream'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustError } from '../../errors/PrismaClientRustError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import { Engine } from '../common/Engine'
import { resolveEnginePath } from '../common/resolveEnginePath'
import type { LogEmitter, LogEventType } from '../common/types/Events'
import { JsonQuery } from '../common/types/JsonProtocol'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type { QueryEngineResult } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import type { RustLog } from '../common/utils/log'
import { convertLog, getMessage, isRustErrorLog } from '../common/utils/log'
import { Connection, Result } from './Connection'

const debug = Debug('prisma:engine')

// eslint-disable-next-line
const logger = (...args) => {}

/**
 * Node.js based wrapper to run the Prisma binary
 */

const knownBinaryTargets: BinaryTarget[] = [...binaryTargets, 'native']

export type Deferred = {
  resolve: () => void
  reject: (err: Error) => void
}

export type StopDeferred = {
  resolve: (code: number | null) => void
  reject: (err: Error) => void
}

const engines: BinaryEngine[] = []

const MAX_STARTS = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2
const MAX_REQUEST_RETRIES = process.env.PRISMA_CLIENT_NO_RETRY ? 1 : 2

export class BinaryEngine implements Engine<undefined> {
  name = 'BinaryEngine' as const
  private config: EngineConfig
  private logEmitter: LogEmitter
  private showColors: boolean
  private logQueries: boolean
  private env?: Record<string, string>
  private flags: string[]
  private enableDebugLogs: boolean
  private allowTriggerPanic: boolean
  private child?: ChildProcessByStdio<null, Readable, Readable>
  private clientVersion?: string
  private globalKillSignalReceived?: string
  private startCount = 0
  private previewFeatures: string[] = []
  private engineEndpoint?: string
  private lastError?: PrismaClientRustError
  private stopPromise?: Promise<void>
  private beforeExitListener?: () => Promise<void>
  private cwd: string
  private datamodelPath: string
  private stderrLogs = ''
  private currentRequestPromise?: any
  private binaryTargetPromise?: Promise<BinaryTarget>
  // The rule is ignored here, using String didn't work as expected,
  // see https://github.com/prisma/prisma/pull/20165/commits/8059a14d8f2edbb15d6f7dbeeac74ba4a0a568ec
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  private binaryTarget?: BinaryTarget | string
  private datasourceOverrides?: { name: string; url: string }[]
  private startPromise?: Promise<void>
  private versionPromise?: Promise<string>
  private engineStartDeferred?: Deferred
  private engineStopDeferred?: StopDeferred
  private connection: Connection
  private lastQuery?: string
  private lastVersion?: string
  private lastActiveProvider?: ConnectorType
  private activeProvider?: string
  private tracingHelper: TracingHelper

  /**
   * exiting is used to tell the .on('exit') hook, if the exit came from our script.
   * As soon as the Prisma binary returns a correct return code (like 1 or 0), we don't need this anymore
   */
  constructor(config: EngineConfig) {
    this.config = config
    this.env = config.env
    this.cwd = this.resolveCwd(config.cwd)
    this.enableDebugLogs = config.enableDebugLogs ?? false
    this.allowTriggerPanic = config.allowTriggerPanic ?? false
    this.datamodelPath = config.datamodelPath
    this.tracingHelper = config.tracingHelper
    this.logEmitter = config.logEmitter
    this.showColors = config.showColors ?? false
    this.logQueries = config.logQueries ?? false
    this.clientVersion = config.clientVersion
    this.flags = config.flags ?? []
    this.previewFeatures = config.previewFeatures ?? []
    this.activeProvider = config.activeProvider
    this.connection = new Connection()

    // compute the datasource override for binary engine
    const dsOverrideName = Object.keys(config.overrideDatasources)[0]
    const dsOverrideUrl = config.overrideDatasources[dsOverrideName]?.url
    if (dsOverrideName !== undefined && dsOverrideUrl !== undefined) {
      this.datasourceOverrides = [{ name: dsOverrideName, url: dsOverrideUrl }]
    }

    initHooks()

    // See also warnOnDeprecatedFeatureFlag at
    // https://github.com/prisma/prisma/blob/9e5cc5bfb9ef0eb8251ab85a56302e835f607711/packages/sdk/src/engine-commands/getDmmf.ts#L179
    const removedFlags = [
      'middlewares',
      'aggregateApi',
      'distinct',
      'aggregations',
      'insensitiveFilters',
      'atomicNumberOperations',
      'transactionApi',
      'transaction',
      'connectOrCreate',
      'uncheckedScalarInputs',
      'nativeTypes',
      'createMany',
      'groupBy',
      'referentialActions',
      'microsoftSqlServer',
    ]
    const removedFlagsUsed = this.previewFeatures.filter((e) => removedFlags.includes(e))

    if (removedFlagsUsed.length > 0 && !process.env.PRISMA_HIDE_PREVIEW_FLAG_WARNINGS) {
      console.log(
        `${blue(bold('info'))} The preview flags \`${removedFlagsUsed.join(
          '`, `',
        )}\` were removed, you can now safely remove them from your schema.prisma.`,
      )
    }

    this.previewFeatures = this.previewFeatures.filter((e) => !removedFlags.includes(e))
    this.engineEndpoint = config.engineEndpoint

    if (this.binaryTarget) {
      if (!knownBinaryTargets.includes(this.binaryTarget as BinaryTarget) && !fs.existsSync(this.binaryTarget)) {
        throw new PrismaClientInitializationError(
          `Unknown ${red('PRISMA_QUERY_ENGINE_BINARY')} ${red(
            bold(this.binaryTarget),
          )}. Possible binaryTargets: ${green(knownBinaryTargets.join(', '))} or a path to the query engine binary.
You may have to run ${green('prisma generate')} for your changes to take effect.`,
          this.clientVersion!,
        )
      }
    } else {
      void this.getCurrentBinaryTarget()
    }
    if (this.enableDebugLogs) {
      Debug.enable('*')
    }
    engines.push(this)
    this.checkForTooManyEngines()
  }

  // Set error sets an error for async processing, when this doesn't happen in the span of a request
  // lifecycle, and is instead reported through STDOUT/STDERR of the server.
  //
  // See `throwAsyncErrorIfExists` for more information
  private setError(err: RustLog): void {
    if (isRustErrorLog(err)) {
      this.lastError = new PrismaClientRustError({
        clientVersion: this.clientVersion!,
        error: err,
      })
      if (this.lastError.isPanic()) {
        if (this.child) {
          this.stopPromise = killProcessAndWait(this.child)
        }
        if (this.currentRequestPromise?.cancel) {
          this.currentRequestPromise.cancel()
        }
      }
    }
  }

  private checkForTooManyEngines() {
    if (engines.length >= 10) {
      const runningEngines = engines.filter((e) => e.child)
      if (runningEngines.length === 10) {
        console.warn(
          `${bold(
            yellow('warn(prisma-client)'),
          )} This is the 10th instance of Prisma Client being started. Make sure this is intentional.`,
        )
      }
    }
  }

  private resolveCwd(cwd: string): string {
    if (fs.existsSync(cwd) && fs.lstatSync(cwd).isDirectory()) {
      return cwd
    }

    return process.cwd()
  }

  onBeforeExit(listener: () => Promise<void>) {
    this.beforeExitListener = listener
  }

  async emitExit() {
    if (this.beforeExitListener) {
      try {
        await this.beforeExitListener()
      } catch (e) {
        console.error(e)
      }
    }
  }

  private async getCurrentBinaryTarget(): Promise<BinaryTarget> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.binaryTargetPromise) {
      return this.binaryTargetPromise
    }

    this.binaryTargetPromise = getBinaryTargetForCurrentPlatform()

    return this.binaryTargetPromise
  }

  private printDatasources(): string {
    if (this.datasourceOverrides) {
      return JSON.stringify(this.datasourceOverrides)
    }

    return '[]'
  }

  /**
   * Starts the engine, returns the url that it runs on
   */
  async start(): Promise<void> {
    if (this.stopPromise) {
      await this.stopPromise
    }

    // retries added in https://github.com/prisma/prisma/pull/18874 to avoid test flakyness
    const retries = { times: 10 }
    const retryInternalStart = async () => {
      try {
        await this.internalStart()
      } catch (e) {
        if (e.retryable === true && retries.times > 0) {
          retries.times--
          await retryInternalStart()
        }

        throw e
      }
    }

    const startFn = async () => {
      if (!this.startPromise) {
        this.startCount++
        this.startPromise = retryInternalStart()
      }

      await this.startPromise

      if (!this.child && !this.engineEndpoint) {
        throw new PrismaClientUnknownRequestError(`Can't perform request, as the Engine has already been stopped`, {
          clientVersion: this.clientVersion!,
        })
      }
    }

    if (this.startPromise) {
      return startFn()
    }

    return this.tracingHelper.runInChildSpan('connect', startFn)
  }

  private getEngineEnvVars() {
    const env: any = {
      PRISMA_DML_PATH: this.datamodelPath,
    }

    if (this.logQueries) {
      env.LOG_QUERIES = 'true'
    }

    if (this.datasourceOverrides) {
      env.OVERWRITE_DATASOURCES = this.printDatasources()
    }

    if (!process.env.NO_COLOR && this.showColors) {
      env.CLICOLOR_FORCE = '1'
    }

    return {
      ...this.env, // user-provided env vars
      ...process.env,
      ...env,
      // use value from process.env or use default
      RUST_BACKTRACE: process.env.RUST_BACKTRACE ?? '1',
      RUST_LOG: process.env.RUST_LOG ?? 'info',
    }
  }

  private internalStart(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      await new Promise((r) => process.nextTick(r))
      if (this.stopPromise) {
        await this.stopPromise
      }
      if (this.engineEndpoint) {
        try {
          this.connection.open(this.engineEndpoint)
          await pRetry(() => this.connection.get('/status'), {
            retries: 10,
          })
        } catch (e) {
          return reject(e)
        }
        return resolve()
      }
      try {
        if (this.child?.connected || (this.child && !this.child?.killed)) {
          debug(`There is a child that still runs and we want to start again`)
        }

        // reset last error
        this.lastError = undefined
        logger('startin & resettin')
        this.globalKillSignalReceived = undefined

        debug({ cwd: this.cwd })

        const prismaPath = await resolveEnginePath(ClientEngineType.Binary, this.config)

        const additionalFlag = this.allowTriggerPanic ? ['--debug'] : []

        const flags = [
          '--enable-raw-queries',
          '--enable-metrics',
          '--enable-open-telemetry',
          ...this.flags,
          ...additionalFlag,
        ]

        flags.push('--port', '0')
        flags.push('--engine-protocol', 'json')

        debug({ flags })

        const env = this.getEngineEnvVars()

        this.child = spawn(prismaPath, flags, {
          env,
          cwd: this.cwd,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        byline(this.child.stderr).on('data', (msg) => {
          const data = String(msg)
          debug('stderr', data)

          try {
            const json = JSON.parse(data)
            if (typeof json.is_panic !== 'undefined') {
              debug(json)
              this.setError(json)
              if (this.engineStartDeferred) {
                const err = new PrismaClientInitializationError(json.message, this.clientVersion!, json.error_code)
                this.engineStartDeferred.reject(err)
              }
            }
          } catch (e) {
            if (!data.includes('Printing to stderr') && !data.includes('Listening on ')) {
              this.stderrLogs += '\n' + data
            }
          }
        })

        byline(this.child.stdout).on('data', (msg) => {
          const data = String(msg)

          try {
            const json = JSON.parse(data)
            debug('stdout', getMessage(json))

            if (
              this.engineStartDeferred &&
              json.level === 'INFO' &&
              json.target === 'query_engine::server' &&
              json.fields?.message?.startsWith('Started query engine http server')
            ) {
              const ip = json.fields.ip
              const port = json.fields.port

              if (ip === undefined || port === undefined) {
                this.engineStartDeferred.reject(
                  new PrismaClientInitializationError(
                    'This version of Query Engine is not compatible with Prisma Client: "ip" and "port" fields are missing in the startup log entry',
                    this.clientVersion!,
                  ),
                )
                return
              }

              this.connection.open(`http://${ip}:${port}`)
              this.engineStartDeferred.resolve()
              this.engineStartDeferred = undefined
            }

            // only emit logs, if they're in the from of a log
            // they could also be a RustError, which has is_panic
            // these logs can still include error logs
            if (typeof json.is_panic === 'undefined') {
              if (json.span === true) {
                this.tracingHelper.createEngineSpan(json as EngineSpanEvent)

                return
              }

              const log = convertLog(json)
              // boolean cast needed, because of TS. We return ` is RustLog`, useful in other context, but not here
              const logIsRustErrorLog: boolean = isRustErrorLog(log)
              if (logIsRustErrorLog) {
                this.setError(log)
              } else if (log.level === 'query') {
                this.logEmitter.emit(log.level, {
                  timestamp: log.timestamp,
                  query: log.fields.query,
                  params: log.fields.params,
                  duration: log.fields.duration_ms,
                  target: log.target,
                })
              } else {
                this.logEmitter.emit(log.level as LogEventType, {
                  timestamp: log.timestamp,
                  message: log.fields.message,
                  target: log.target,
                })
              }
            } else {
              this.setError(json)
            }
          } catch (e) {
            debug(e, data)
          }
        })

        this.child.on('exit', (code): void => {
          logger('removing startPromise')
          this.startPromise = undefined
          if (this.engineStopDeferred) {
            this.engineStopDeferred.resolve(code)
            return
          }
          this.connection.close()

          // don't error in restarts
          if (code !== 0 && this.engineStartDeferred && this.startCount === 1) {
            let err: PrismaClientInitializationError
            let msg = this.stderrLogs
            // get the message from the last error
            if (this.lastError) {
              msg = getMessage(this.lastError)
            }
            if (code !== null) {
              err = new PrismaClientInitializationError(
                `Query engine exited with code ${code}\n` + msg,
                this.clientVersion!,
              )
              err.retryable = true
            } else if (this.child?.signalCode) {
              err = new PrismaClientInitializationError(
                `Query engine process killed with signal ${this.child.signalCode} for unknown reason.
Make sure that the engine binary at ${prismaPath} is not corrupt.\n` + msg,
                this.clientVersion!,
              )
              err.retryable = true
            } else {
              err = new PrismaClientInitializationError(msg, this.clientVersion!)
            }

            this.engineStartDeferred.reject(err)
          }
          if (!this.child) {
            return
          }
          if (this.lastError) {
            return
          }
          if (code === 126) {
            this.setError({
              timestamp: new Date(),
              target: 'binary engine process exit',
              level: 'error',
              fields: {
                message: `Couldn't start query engine as it's not executable on this operating system.
You very likely have the wrong "binaryTarget" defined in the schema.prisma file.`,
              },
            })
          }
        })

        this.child.on('error', (err): void => {
          this.setError({
            timestamp: new Date(),
            target: 'binary engine process error',
            level: 'error',
            fields: {
              message: `Couldn't start query engine: ${err}`,
            },
          })
          reject(err)
        })

        this.child.on('close', (code, signal): void => {
          this.connection.close()

          let toEmit: { message: string } | undefined

          if (code === null && signal === 'SIGABRT' && this.child) {
            toEmit = new PrismaClientRustPanicError(
              this.getErrorMessageWithLink('Panic in Query Engine with SIGABRT signal'),
              this.clientVersion!,
            )
          } else if (code === 255 && signal === null && this.lastError) {
            toEmit = this.lastError
          }

          if (toEmit) {
            this.logEmitter.emit('error', {
              message: toEmit.message,
              timestamp: new Date(),
              target: 'binary engine process close',
            })
          }
        })

        if (this.lastError) {
          return reject(new PrismaClientInitializationError(getMessage(this.lastError), this.clientVersion!))
        }

        try {
          await new Promise<void>((resolve, reject) => {
            this.engineStartDeferred = { resolve, reject }
          })
        } catch (err) {
          this.child?.kill()
          throw err
        }

        // don't wait for this
        void (async () => {
          try {
            const engineVersion = await this.version(true)
            debug(`Client Version: ${this.clientVersion}`)
            debug(`Engine Version: ${engineVersion}`)
            debug(`Active provider: ${this.activeProvider}`)
          } catch (e) {
            debug(e)
          }
        })()

        this.stopPromise = undefined
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  async stop(): Promise<void> {
    const stopFn = async () => {
      if (!this.stopPromise) {
        this.stopPromise = this._stop()
      }

      return this.stopPromise
    }

    return this.tracingHelper.runInChildSpan('disconnect', stopFn)
  }

  /**
   * If Prisma runs, stop it
   */
  async _stop(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise
    }
    // not sure yet if this is a good idea
    await new Promise((resolve) => process.nextTick(resolve))
    if (this.currentRequestPromise) {
      try {
        await this.currentRequestPromise
      } catch (e) {
        //
      }
    }
    let stopChildPromise
    if (this.child) {
      debug(`Stopping Prisma engine`)
      if (this.startPromise) {
        debug(`Waiting for start promise`)
        await this.startPromise
      }
      debug(`Done waiting for start promise`)
      if (this.child.exitCode === null) {
        stopChildPromise = new Promise((resolve, reject) => {
          this.engineStopDeferred = { resolve, reject }
        })
      } else {
        debug('Child already exited with code', this.child.exitCode)
      }
      this.connection.close()
      this.child.kill()
      this.child = undefined
    }
    if (stopChildPromise) {
      await stopChildPromise
    }
    await new Promise((r) => process.nextTick(r))
    this.startPromise = undefined
    this.engineStopDeferred = undefined
  }

  kill(signal: string): void {
    this.globalKillSignalReceived = signal
    this.child?.kill()
    this.connection.close()
  }

  async version(forceRun = false) {
    if (this.versionPromise && !forceRun) {
      return this.versionPromise
    }
    this.versionPromise = this.internalVersion()
    return this.versionPromise
  }

  async internalVersion() {
    const enginePath = await resolveEnginePath(ClientEngineType.Binary, this.config)

    const result = await execa(enginePath, ['--version'])

    this.lastVersion = result.stdout
    return this.lastVersion
  }

  async request<T>(
    query: JsonQuery,
    { traceparent, numTry = 1, isWrite, interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<QueryEngineResult<T>> {
    await this.start()
    const headers: Record<string, string> = {}
    if (traceparent) {
      headers.traceparent = traceparent
    }

    if (interactiveTransaction) {
      headers['X-transaction-id'] = interactiveTransaction.id
    }

    const queryStr = JSON.stringify(query)
    this.currentRequestPromise = Connection.onHttpError(this.connection.post('/', queryStr, headers), (result) =>
      this.httpErrorHandler(result),
    )
    this.lastQuery = queryStr

    try {
      const { data, headers } = await this.currentRequestPromise

      if (data.errors) {
        if (data.errors.length === 1) {
          throw prismaGraphQLToJSError(data.errors[0], this.clientVersion!, this.config.activeProvider!)
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), { clientVersion: this.clientVersion! })
      }

      // Rust engine returns time in microseconds and we want it in milliseconds
      const elapsed = parseInt(headers['x-elapsed']) / 1000

      // reset restart count after successful request
      if (this.startCount > 0) {
        this.startCount = 0
      }

      this.currentRequestPromise = undefined
      return { data, elapsed } as any
    } catch (e: any) {
      logger('req - e', e)

      const { error, shouldRetry } = await this.handleRequestError(e)

      // retry
      if (numTry <= MAX_REQUEST_RETRIES && shouldRetry && !isWrite) {
        logger('trying a retry now')
        return this.request(query, { traceparent, numTry: numTry + 1, isWrite, interactiveTransaction })
      }

      throw error
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { traceparent, transaction, numTry = 1, containsWrite }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    await this.start()

    const headers: Record<string, string> = {}
    if (traceparent) {
      headers.traceparent = traceparent
    }

    const itx = transaction?.kind === 'itx' ? transaction.options : undefined
    if (itx) {
      headers['X-transaction-id'] = itx.id
    }

    const request = getBatchRequestPayload(queries, transaction)

    this.lastQuery = JSON.stringify(request)
    this.currentRequestPromise = Connection.onHttpError(this.connection.post('/', this.lastQuery, headers), (result) =>
      this.httpErrorHandler(result),
    )

    return this.currentRequestPromise
      .then(({ data, headers }) => {
        // Rust engine returns time in microseconds and we want it in milliseconds
        const elapsed = parseInt(headers['x-elapsed']) / 1000
        const { batchResult } = data
        if (Array.isArray(batchResult)) {
          return batchResult.map((result) => {
            if (result.errors && result.errors.length > 0) {
              return prismaGraphQLToJSError(result.errors[0], this.clientVersion!, this.config.activeProvider!)
            }
            return {
              data: result,
              elapsed,
            }
          })
        } else {
          throw prismaGraphQLToJSError(data.errors[0], this.clientVersion!, this.config.activeProvider!)
        }
      })
      .catch(async (e) => {
        const { error, shouldRetry } = await this.handleRequestError(e)
        if (shouldRetry && !containsWrite) {
          // retry
          if (numTry <= MAX_REQUEST_RETRIES) {
            return this.requestBatch(queries, {
              traceparent,
              transaction,
              numTry: numTry + 1,
              containsWrite,
            })
          }
        }

        throw error
      })
  }

  /**
   * Send START, COMMIT, or ROLLBACK to the Query Engine
   * @param action START, COMMIT, or ROLLBACK
   * @param headers headers for tracing
   * @param options to change the default timeouts
   * @param info transaction information for the QE
   */
  async transaction(
    action: 'start',
    headers: Tx.TransactionHeaders,
    options: Tx.Options,
  ): Promise<Tx.InteractiveTransactionInfo<undefined>>
  async transaction(
    action: 'commit',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  async transaction(
    action: 'rollback',
    headers: Tx.TransactionHeaders,
    info: Tx.InteractiveTransactionInfo<undefined>,
  ): Promise<undefined>
  async transaction(action: any, headers: Tx.TransactionHeaders, arg?: any) {
    await this.start()

    if (action === 'start') {
      const jsonOptions = JSON.stringify({
        max_wait: arg.maxWait,
        timeout: arg.timeout,
        isolation_level: arg.isolationLevel,
      })

      const result = await Connection.onHttpError(
        this.connection.post<Tx.InteractiveTransactionInfo<undefined>>('/transaction/start', jsonOptions, headers),
        (result) => this.httpErrorHandler(result),
      )

      return result.data
    } else if (action === 'commit') {
      await Connection.onHttpError(this.connection.post(`/transaction/${arg.id}/commit`), (result) =>
        this.httpErrorHandler(result),
      )
    } else if (action === 'rollback') {
      await Connection.onHttpError(this.connection.post(`/transaction/${arg.id}/rollback`), (result) =>
        this.httpErrorHandler(result),
      )
    }

    return undefined
  }

  private get hasMaxRestarts() {
    return this.startCount >= MAX_STARTS
  }

  /**
   * This processes errors that didn't occur synchronously during a request, and were instead inferred
   * from the STDOUT/STDERR streams of the Query Engine process.
   *
   * See `setError` for more information.
   */
  private throwAsyncErrorIfExists(forceThrow = false) {
    logger('throwAsyncErrorIfExists', this.startCount, this.hasMaxRestarts)
    if (this.lastError && (this.hasMaxRestarts || forceThrow)) {
      const lastError = this.lastError
      // reset error, as we are throwing it now
      this.lastError = undefined
      if (lastError.isPanic()) {
        throw new PrismaClientRustPanicError(this.getErrorMessageWithLink(getMessage(lastError)), this.clientVersion!)
      } else {
        throw new PrismaClientUnknownRequestError(this.getErrorMessageWithLink(getMessage(lastError)), {
          clientVersion: this.clientVersion!,
        })
      }
    }
  }

  private getErrorMessageWithLink(title: string) {
    return getErrorMessageWithLink({
      binaryTarget: this.binaryTarget,
      title,
      version: this.clientVersion!,
      engineVersion: this.lastVersion,
      database: this.lastActiveProvider,
      query: this.lastQuery!,
    })
  }

  /**
   * handleRequestError will process existing errors coming from the request, or else look
   * for the last error happening in the Query Engine process and processed from the STDOUT/STEDERR
   * streams.
   *
   * See `setError` and `throwAsyncErrorIfExists` for more information.
   */
  private handleRequestError = async (
    error: Error & { code?: string },
  ): Promise<{ error: Error & { code?: string }; shouldRetry: boolean }> => {
    debug({ error })

    // if we are starting, wait for it before we handle any error
    if (this.startPromise) {
      await this.startPromise
    }

    // matching on all relevant error codes from
    // https://github.com/nodejs/undici/blob/2.x/lib/core/errors.js
    const isNetworkError = [
      'ECONNRESET',
      'ECONNREFUSED',
      'UND_ERR_CLOSED',
      'UND_ERR_SOCKET',
      'UND_ERR_DESTROYED',
      'UND_ERR_ABORTED',
    ].includes(error.code as string)

    if (error instanceof PrismaClientKnownRequestError) {
      return { error, shouldRetry: false }
    }

    try {
      this.throwAsyncErrorIfExists()

      // A currentRequestPromise is only being canceled by the sendPanic function
      if (this.currentRequestPromise?.isCanceled) {
        this.throwAsyncErrorIfExists()
      } else if (isNetworkError) {
        if (this.globalKillSignalReceived && !this.child?.connected) {
          throw new PrismaClientUnknownRequestError(
            `The Node.js process already received a ${this.globalKillSignalReceived} signal, therefore the Prisma query engine exited
  and your request can't be processed.
  You probably have some open handle that prevents your process from exiting.
  It could be an open http server or stream that didn't close yet.
  We recommend using the \`wtfnode\` package to debug open handles.`,
            { clientVersion: this.clientVersion! },
          )
        }

        this.throwAsyncErrorIfExists()

        if (this.startCount > MAX_STARTS) {
          // if we didn't throw yet, which is unlikely, we want to poll on stderr / stdout here
          // to get an error first
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 50))
            this.throwAsyncErrorIfExists(true)
          }

          throw new Error(`Query engine is trying to restart, but can't.
  Please look into the logs or turn on the env var DEBUG=* to debug the constantly restarting query engine.`)
        }
      }

      this.throwAsyncErrorIfExists(true)

      throw error
    } catch (e) {
      return { error: e, shouldRetry: isNetworkError }
    }
  }

  async metrics(options: MetricsOptionsJson): Promise<Metrics>
  async metrics(options: MetricsOptionsPrometheus): Promise<string>
  async metrics({ format, globalLabels }: EngineMetricsOptions): Promise<string | Metrics> {
    await this.start()
    const parseResponse = format === 'json'
    const response = await this.connection.post<string | Metrics>(
      `/metrics?format=${encodeURIComponent(format)}`,
      JSON.stringify(globalLabels),
      null,
      parseResponse,
    )
    return response.data
  }

  /**
   * Decides how to handle non-200 http error responses
   * @param result
   */
  httpErrorHandler<R>(result: Result<R>): never {
    const response = result.data as { [K: string]: unknown }
    throw new PrismaClientKnownRequestError(response.message as string, {
      code: response.error_code as string,
      clientVersion: this.clientVersion as string,
      meta: response.meta as Record<string, unknown>,
    })
  }
}

function hookProcess(handler: string, exit = false) {
  process.once(handler as any, async () => {
    for (const engine of engines) {
      await engine.emitExit()
      engine.kill(handler)
    }
    engines.splice(0, engines.length)

    // only exit, if only we are listening
    // if there is another listener, that other listener is responsible
    if (exit && process.listenerCount(handler) === 0) {
      process.exit()
    }
  })
}

let hooksInitialized = false
function initHooks() {
  if (!hooksInitialized) {
    hookProcess('beforeExit')
    hookProcess('exit')
    hookProcess('SIGINT', true)
    hookProcess('SIGUSR2', true)
    hookProcess('SIGTERM', true)
    hooksInitialized = true
  }
}

function killProcessAndWait(childProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    childProcess.once('exit', resolve)
    childProcess.kill()
  })
}
