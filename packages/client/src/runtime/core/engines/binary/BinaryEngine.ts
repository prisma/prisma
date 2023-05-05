import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import type { ConnectorType, DMMF, GeneratorConfig } from '@prisma/generator-helper'
import type { Platform } from '@prisma/get-platform'
import { getPlatform, platforms } from '@prisma/get-platform'
import { EngineSpanEvent, fixBinaryTargets, plusX, printGeneratorConfig, TracingHelper } from '@prisma/internals'
import type { ChildProcess, ChildProcessByStdio } from 'child_process'
import { spawn } from 'child_process'
import execa from 'execa'
import fs from 'fs'
import { blue, bold, dim, green, red, underline, yellow } from 'kleur/colors'
import pRetry from 'p-retry'
import path from 'path'
import type { Readable } from 'stream'
import { promisify } from 'util'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustError } from '../../errors/PrismaClientRustError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type {
  BatchQueryEngineResult,
  DatasourceOverwrite,
  EngineBatchQueries,
  EngineConfig,
  EngineEventType,
  EngineQuery,
  RequestBatchOptions,
  RequestOptions,
} from '../common/Engine'
import { Engine } from '../common/Engine'
import { EventEmitter } from '../common/types/Events'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type { QueryEngineResult } from '../common/types/QueryEngine'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import type { RustLog } from '../common/utils/log'
import { convertLog, getMessage, isRustErrorLog } from '../common/utils/log'
import byline from '../tools/byline'
import { omit } from '../tools/omit'
import type { Result } from './Connection'
import { Connection } from './Connection'

const debug = Debug('prisma:engine')
const exists = promisify(fs.exists)

// eslint-disable-next-line
const logger = (...args) => {}

/**
 * Node.js based wrapper to run the Prisma binary
 */

const knownPlatforms: Platform[] = [...platforms, 'native']

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

export class BinaryEngine extends Engine<undefined> {
  private logEmitter: EventEmitter
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
  private getDmmfPromise?: Promise<DMMF.Document>
  private stopPromise?: Promise<void>
  private beforeExitListener?: () => Promise<void>
  private dirname?: string
  private cwd: string
  private datamodelPath: string
  private prismaPath?: string
  private stderrLogs = ''
  private currentRequestPromise?: any
  private platformPromise?: Promise<Platform>
  private platform?: Platform | string
  private generator?: GeneratorConfig
  private incorrectlyPinnedBinaryTarget?: string
  private datasources?: DatasourceOverwrite[]
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
  constructor({
    cwd,
    datamodelPath,
    prismaPath,
    generator,
    datasources,
    showColors,
    logQueries,
    env,
    flags,
    clientVersion,
    previewFeatures,
    engineEndpoint,
    enableDebugLogs,
    allowTriggerPanic,
    dirname,
    activeProvider,
    tracingHelper,
    logEmitter,
  }: EngineConfig) {
    super()

    this.dirname = dirname
    this.env = env
    this.cwd = this.resolveCwd(cwd)
    this.enableDebugLogs = enableDebugLogs ?? false
    this.allowTriggerPanic = allowTriggerPanic ?? false
    this.datamodelPath = datamodelPath
    this.prismaPath = process.env.PRISMA_QUERY_ENGINE_BINARY ?? prismaPath
    this.generator = generator
    this.datasources = datasources
    this.tracingHelper = tracingHelper
    this.logEmitter = logEmitter
    this.showColors = showColors ?? false
    this.logQueries = logQueries ?? false
    this.clientVersion = clientVersion
    this.flags = flags ?? []
    this.previewFeatures = previewFeatures ?? []
    this.activeProvider = activeProvider
    this.connection = new Connection()

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
    this.engineEndpoint = engineEndpoint

    if (this.platform) {
      if (!knownPlatforms.includes(this.platform as Platform) && !fs.existsSync(this.platform)) {
        throw new PrismaClientInitializationError(
          `Unknown ${red('PRISMA_QUERY_ENGINE_BINARY')} ${red(bold(this.platform))}. Possible binaryTargets: ${green(
            knownPlatforms.join(', '),
          )} or a path to the query engine binary.
You may have to run ${green('prisma generate')} for your changes to take effect.`,
          this.clientVersion!,
        )
      }
    } else {
      void this.getPlatform()
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
          `${bold(yellow('warn(prisma-client)'))} There are already 10 instances of Prisma Client actively running.`,
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

  on(event: EngineEventType, listener: (args?: any) => any): void {
    if (event === 'beforeExit') {
      this.beforeExitListener = listener
    } else {
      this.logEmitter.on(event, listener)
    }
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

  private async getPlatform(): Promise<Platform> {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (this.platformPromise) {
      return this.platformPromise
    }

    this.platformPromise = getPlatform()

    return this.platformPromise
  }

  private getQueryEnginePath(platform: string, prefix: string = __dirname): string {
    let queryEnginePath = path.join(prefix, `query-engine-${platform}`)

    if (platform === 'windows') {
      queryEnginePath = `${queryEnginePath}.exe`
    }

    return queryEnginePath
  }

  private async resolvePrismaPath(): Promise<{
    prismaPath: string
    searchedLocations: string[]
  }> {
    const searchedLocations: string[] = []
    let enginePath
    if (this.prismaPath) {
      return { prismaPath: this.prismaPath, searchedLocations }
    }

    const platform = await this.getPlatform()
    if (this.platform && this.platform !== platform) {
      this.incorrectlyPinnedBinaryTarget = this.platform
    }

    this.platform = this.platform || platform

    if (__filename.includes('BinaryEngine')) {
      enginePath = this.getQueryEnginePath(this.platform, getEnginesPath())
      return { prismaPath: enginePath, searchedLocations }
    }
    const searchLocations: string[] = [
      eval(`require('path').join(__dirname, '../../../.prisma/client')`), // Dot Prisma Path
      this.generator?.output?.value ?? eval('__dirname'), // Custom Generator Path
      path.join(eval('__dirname'), '..'), // parentDirName
      path.dirname(this.datamodelPath), // Datamodel Dir
      this.cwd, //cwdPath
      '/tmp/prisma-engines',
    ]

    if (this.dirname) {
      searchLocations.push(this.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Search for Query Engine in ${location}`)
      enginePath = this.getQueryEnginePath(this.platform, location)
      if (fs.existsSync(enginePath)) {
        return { prismaPath: enginePath, searchedLocations }
      }
    }
    enginePath = this.getQueryEnginePath(this.platform)

    return { prismaPath: enginePath ?? '', searchedLocations }
  }

  // get prisma path
  private async getPrismaPath(): Promise<string> {
    const { prismaPath, searchedLocations } = await this.resolvePrismaPath()
    const platform = await this.getPlatform()
    // If path to query engine doesn't exist, throw
    if (!(await exists(prismaPath))) {
      const pinnedStr = this.incorrectlyPinnedBinaryTarget
        ? `\nYou incorrectly pinned it to ${red(bold(`${this.incorrectlyPinnedBinaryTarget}`))}\n`
        : ''

      let errorText = `Query engine binary for current platform "${bold(platform)}" could not be found.${pinnedStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${underline(prismaPath)}")

Searched Locations:

${searchedLocations
  .map((f) => {
    let msg = `  ${f}`
    if (process.env.DEBUG === 'node-engine-search-locations' && fs.existsSync(f)) {
      const dir = fs.readdirSync(f)
      msg += dir.map((d) => `    ${d}`).join('\n')
    }
    return msg
  })
  .join('\n' + (process.env.DEBUG === 'node-engine-search-locations' ? '\n' : ''))}\n`
      // The generator should always be there during normal usage
      if (this.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        if (
          this.generator.binaryTargets.find((object) => object.value === this.platform!) ||
          this.generator.binaryTargets.find((object) => object.value === 'native')
        ) {
          errorText += `
You already added the platform${this.generator.binaryTargets.length > 1 ? 's' : ''} ${this.generator.binaryTargets
            .map((t) => `"${bold(t.value)}"`)
            .join(', ')} to the "${underline('generator')}" block
in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
but something went wrong. That's suboptimal.

Please create an issue at https://github.com/prisma/prisma/issues/new`
          errorText += ``
        } else {
          // If they didn't even have the current running platform in the schema.prisma file, it's easy
          // Just add it
          errorText += `\n\nTo solve this problem, add the platform "${this.platform}" to the "${underline(
            'binaryTargets',
          )}" attribute in the "${underline('generator')}" block in the "schema.prisma" file:
${green(this.getFixedGenerator())}

Then run "${green('prisma generate')}" for your changes to take effect.
Read more about deploying Prisma Client: https://pris.ly/d/client-generator`
        }
      } else {
        errorText += `\n\nRead more about deploying Prisma Client: https://pris.ly/d/client-generator\n`
      }

      throw new PrismaClientInitializationError(errorText, this.clientVersion!)
    }

    if (this.incorrectlyPinnedBinaryTarget) {
      console.error(`${bold(yellow('Warning:'))} You pinned the platform ${bold(
        this.incorrectlyPinnedBinaryTarget,
      )}, but Prisma Client detects ${bold(await this.getPlatform())}.
This means you should very likely pin the platform ${green(await this.getPlatform())} instead.
${dim("In case we're mistaken, please report this to us 🙏.")}`)
    }

    if (process.platform !== 'win32') {
      plusX(prismaPath)
    }

    return prismaPath
  }

  private getFixedGenerator(): string {
    const fixedGenerator = {
      ...this.generator!,
      binaryTargets: fixBinaryTargets(this.generator!.binaryTargets, this.platform!),
    }

    return printGeneratorConfig(fixedGenerator)
  }

  private printDatasources(): string {
    if (this.datasources) {
      return JSON.stringify(this.datasources)
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

    if (this.datasources) {
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

        const prismaPath = await this.getPrismaPath()

        const additionalFlag = this.allowTriggerPanic ? ['--debug'] : []

        const flags = [
          '--enable-raw-queries',
          '--enable-metrics',
          '--enable-open-telemetry',
          ...this.flags,
          ...additionalFlag,
        ]

        flags.push('--port', '0')

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
                void this.tracingHelper.createEngineSpan(json as EngineSpanEvent)

                return
              }

              const log = convertLog(json)
              // boolean cast needed, because of TS. We return ` is RustLog`, useful in other context, but not here
              const logIsRustErrorLog: boolean = isRustErrorLog(log)
              if (logIsRustErrorLog) {
                this.setError(log)
              } else {
                this.logEmitter.emit(log.level, log)
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

  async getDmmf(): Promise<DMMF.Document> {
    if (!this.getDmmfPromise) {
      this.getDmmfPromise = this._getDmmf()
    }
    return this.getDmmfPromise
  }

  private async _getDmmf(): Promise<DMMF.Document> {
    const prismaPath = await this.getPrismaPath()

    const env = await this.getEngineEnvVars()

    const result = await execa(prismaPath, ['--enable-raw-queries', 'cli', 'dmmf'], {
      env: omit(env, ['PORT']),
      cwd: this.cwd,
    })

    return JSON.parse(result.stdout)
  }

  async version(forceRun = false) {
    if (this.versionPromise && !forceRun) {
      return this.versionPromise
    }
    this.versionPromise = this.internalVersion()
    return this.versionPromise
  }

  async internalVersion() {
    const prismaPath = await this.getPrismaPath()

    const result = await execa(prismaPath, ['--version'])

    this.lastVersion = result.stdout
    return this.lastVersion
  }

  async request<T>(
    query: EngineQuery,
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
    this.currentRequestPromise = this.connection.post('/', queryStr, headers)
    this.lastQuery = queryStr

    try {
      const { data, headers } = await this.currentRequestPromise
      if (data.errors) {
        if (data.errors.length === 1) {
          throw prismaGraphQLToJSError(data.errors[0], this.clientVersion!)
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
    queries: EngineBatchQueries,
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
    this.currentRequestPromise = this.connection.post('/', this.lastQuery, headers)

    return this.currentRequestPromise
      .then(({ data, headers }) => {
        // Rust engine returns time in microseconds and we want it in milliseconds
        const elapsed = parseInt(headers['x-elapsed']) / 1000
        const { batchResult } = data
        if (Array.isArray(batchResult)) {
          return batchResult.map((result) => {
            if (result.errors && result.errors.length > 0) {
              return prismaGraphQLToJSError(result.errors[0], this.clientVersion!)
            }
            return {
              data: result,
              elapsed,
            }
          })
        } else {
          throw prismaGraphQLToJSError(data.errors[0], this.clientVersion!)
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
    options?: Tx.Options,
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
        max_wait: arg?.maxWait ?? 2000, // default
        timeout: arg?.timeout ?? 5000, // default
        isolation_level: arg?.isolationLevel,
      })

      const result = await Connection.onHttpError(
        this.connection.post<Tx.InteractiveTransactionInfo<undefined>>('/transaction/start', jsonOptions, headers),
        (result) => this.transactionHttpErrorHandler(result),
      )

      return result.data
    } else if (action === 'commit') {
      await Connection.onHttpError(this.connection.post(`/transaction/${arg.id}/commit`), (result) =>
        this.transactionHttpErrorHandler(result),
      )
    } else if (action === 'rollback') {
      await Connection.onHttpError(this.connection.post(`/transaction/${arg.id}/rollback`), (result) =>
        this.transactionHttpErrorHandler(result),
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
      platform: this.platform,
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
   * Decides how to handle error responses for transactions
   * @param result
   */
  transactionHttpErrorHandler<R>(result: Result<R>): never {
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
