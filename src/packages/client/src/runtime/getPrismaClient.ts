import { DMMFClass } from './dmmf'
import { DMMF } from './dmmf-types'
import path from 'path'
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientInitializationError,
  PrismaClientRustPanicError,
} from '.'
import {
  NodeEngine,
  EngineConfig,
  DatasourceOverwrite,
} from '@prisma/engine-core/dist/NodeEngine'
import {
  Document,
  makeDocument,
  unpack,
  transformDocument,
  Args,
} from './query'
import Debug from '@prisma/debug'
const debug = Debug('prisma-client')
import fs from 'fs'
import chalk from 'chalk'
import * as sqlTemplateTag from 'sql-template-tag'
import { parse as parseDotEnv } from 'dotenv'
import { GeneratorConfig } from '@prisma/generator-helper/dist/types'
import { getLogLevel } from './getLogLevel'
import { mergeBy } from './mergeBy'
import { lowerCase } from './utils/common'
import { deepSet } from './utils/deep-set'
import { Dataloader } from './Dataloader'
import { printStack } from './utils/printStack'
import stripAnsi from 'strip-ansi'
import { printJsonWithErrors } from './utils/printJsonErrors'
import { InternalDatasource } from './utils/printDatasources'
import { omit } from './utils/omit'
import { mapExperimentalFeatures } from '@prisma/sdk/dist/utils/mapExperimentalFeatures'
import { serializeRawParameters } from './utils/serializeRawParameters'

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasource = {
  url?: string
}
export type Datasources = Record<string, Datasource>

export interface PrismaClientOptions {
  /**
   * Overwrites the datasource url from your prisma.schema file
   */
  datasources?: Datasources

  /**
   * @default "colorless"
   */
  errorFormat?: ErrorFormat

  /**
   * @example
   * \`\`\`
   * // Defaults to stdout
   * log: ['query', 'info', 'warn']
   *
   * // Emit as events
   * log: [
   *  { emit: 'stdout', level: 'query' },
   *  { emit: 'stdout', level: 'info' },
   *  { emit: 'stdout', level: 'warn' }
   * ]
   * \`\`\`
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
   */
  log?: Array<LogLevel | LogDefinition>

  /**
   * @internal
   * You probably don't want to use this. \`__internal\` is used by internal tooling.
   */
  __internal?: {
    debug?: boolean
    hooks?: Hooks
    engine?: {
      cwd?: string
      binaryPath?: string
      endpoint?: string
      enableEngineDebugMode?: boolean
    }
    measurePerformance?: boolean
  }
}

export type Hooks = {
  beforeRequest?: (options: {
    query: string
    path: string[]
    rootField?: string
    typeName?: string
    document: any
  }) => any
}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<
  T extends LogLevel | LogDefinition
> = T extends LogDefinition
  ? T['emit'] extends 'event'
    ? T['level']
    : never
  : never
export type GetEvents<T extends Array<LogLevel | LogDefinition>> =
  | GetLogType<T[0]>
  | GetLogType<T[1]>
  | GetLogType<T[2]>

export type QueryEvent = {
  timestamp: Date
  query: string
  params: string
  duration: number
  target: string
}

export type LogEvent = {
  timestamp: Date
  message: string
  target: string
}
/* End Types for Logging */

export interface GetPrismaClientOptions {
  document: DMMF.Document
  generator?: GeneratorConfig
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  relativePath: string
  dirname: string
  internalDatasources: Omit<InternalDatasource, 'url'>[]
  clientVersion?: string
  engineVersion?: string
}

// TODO: We **may** be able to get real types. However, we have both a bootstrapping
// problem here, that we want to return a type that's not yet defined
// and we're typecasting this anyway later
export function getPrismaClient(config: GetPrismaClientOptions): any {
  class NewPrismaClient {
    dmmf: DMMFClass
    engine: NodeEngine
    fetcher: PrismaClientFetcher
    connectionPromise?: Promise<any>
    disconnectionPromise?: Promise<any>
    engineConfig: EngineConfig
    internalDatasources: Omit<InternalDatasource, 'url'>[]
    private errorFormat: ErrorFormat
    private measurePerformance: boolean
    private hooks?: Hooks
    constructor(optionsArg?: PrismaClientOptions) {
      const options: PrismaClientOptions = optionsArg ?? {}
      const internal = options.__internal ?? {}

      const useDebug = internal.debug === true
      if (useDebug) {
        Debug.enable('prisma-client')
      }

      if (internal.hooks) {
        this.hooks = internal.hooks
      }

      let predefinedDatasources = config.sqliteDatasourceOverrides ?? []
      predefinedDatasources = predefinedDatasources.map((d) => ({
        name: d.name,
        url: 'file:' + path.resolve(config.dirname, d.url),
      }))

      const inputDatasources = Object.entries(options.datasources || {})
        .filter(([_, source]) => {
          return source && source.url
        })
        .map(([name, { url }]: any) => ({ name, url }))

      const datasources = mergeBy(
        predefinedDatasources,
        inputDatasources,
        (source) => source.name,
      )

      const engineConfig = internal.engine || {}

      if (options.errorFormat) {
        this.errorFormat = options.errorFormat
      } else if (process.env.NODE_ENV === 'production') {
        this.errorFormat = 'minimal'
      } else if (process.env.NO_COLOR) {
        this.errorFormat = 'colorless'
      } else {
        this.errorFormat = 'colorless' // default errorFormat
      }

      this.measurePerformance = internal.measurePerformance || false

      const envFile = this.readEnv()

      this.dmmf = new DMMFClass(config.document)

      this.internalDatasources = config.internalDatasources

      let cwd = path.resolve(config.dirname, config.relativePath)

      if (!fs.existsSync(cwd)) {
        cwd = config.dirname
      }

      this.engineConfig = {
        cwd,
        enableDebugLogs: useDebug,
        enableEngineDebugMode: engineConfig.enableEngineDebugMode,
        datamodelPath: path.join(config.dirname, 'schema.prisma'),
        prismaPath: engineConfig.binaryPath ?? undefined,
        engineEndpoint: engineConfig.endpoint,
        datasources,
        generator: config.generator,
        showColors: this.errorFormat === 'pretty',
        logLevel: options.log && (getLogLevel(options.log) as any), // TODO
        logQueries:
          options.log &&
          Boolean(
            typeof options.log === 'string'
              ? options.log === 'query'
              : options.log.find((o) =>
                  typeof o === 'string' ? o === 'query' : o.level === 'query',
                ),
          ),
        env: envFile,
        flags: [],
        clientVersion: config.clientVersion,
        enableExperimental: mapExperimentalFeatures(
          config.generator?.experimentalFeatures,
        ),
      }

      const sanitizedEngineConfig = omit(this.engineConfig, [
        'env',
        'datasources',
      ])
      debug({ engineConfig: sanitizedEngineConfig })

      this.engine = new NodeEngine(this.engineConfig)
      this.fetcher = new PrismaClientFetcher(this, false, this.hooks)

      if (options.log) {
        for (const log of options.log) {
          const level =
            typeof log === 'string'
              ? log
              : log.emit === 'stdout'
              ? log.level
              : null
          if (level) {
            this.on(level, (event) => {
              const colorMap = {
                query: 'blue',
                info: 'cyan',
                warn: 'yellow',
                error: 'red',
              }
              console.error(
                chalk[colorMap[level]](`prisma:${level}`.padEnd(13)) +
                  (event.message || event.query),
              )
            })
          }
        }
      }

      this.bootstrapClient()
    }
    private readEnv() {
      const dotEnvPath = path.resolve(
        config.dirname,
        config.relativePath,
        '.env',
      )
      if (fs.existsSync(dotEnvPath)) {
        return parseDotEnv(fs.readFileSync(dotEnvPath, 'utf-8'))
      }

      return {}
    }
    on(eventType: any, callback: (event: any) => void) {
      this.engine.on(eventType, (event) => {
        const fields = event.fields
        if (eventType === 'query') {
          callback({
            timestamp: event.timestamp,
            query: fields.query,
            params: fields.params,
            duration: fields.duration_ms,
            target: event.target,
          })
        } else {
          // warn,l info or error events
          callback({
            timestamp: event.timestamp,
            message: fields.message,
            target: event.target,
          })
        }
      })
    }
    async connect() {
      if (this.disconnectionPromise) {
        await this.disconnectionPromise
      }
      if (this.connectionPromise) {
        return this.connectionPromise
      }
      this.connectionPromise = (async () => {
        await this.engine.start()

        let { engineVersion, clientVersion } = config
        if (
          this.engineConfig.prismaPath ||
          process.env.QUERY_ENGINE_BINARY_PATH ||
          !engineVersion
        ) {
          engineVersion = await this.engine.version()
        }
        debug(`Client Version ${clientVersion}`)
        debug(`Engine Version ${engineVersion}`)
      })()
      return this.connectionPromise
    }
    /**
     * @private
     */
    async runDisconnect() {
      await this.engine.stop()
      delete this.connectionPromise
      this.engine = new NodeEngine(this.engineConfig)
      delete this.disconnectionPromise
    }
    /**
     * Disconnect from the database
     */
    async disconnect() {
      if (!this.disconnectionPromise) {
        this.disconnectionPromise = this.runDisconnect()
      }
      return this.disconnectionPromise
    }

    /**
     * Executes a raw query. Always returns a number
     */
    async executeRaw(stringOrTemplateStringsArray, ...values) {
      let query = ''
      let parameters: any = undefined

      const sqlOutput =
        this.internalDatasources[0]?.connectorType === 'postgresql'
          ? 'text'
          : 'sql'

      debug(`Prisma Client call:`)
      if (Array.isArray(stringOrTemplateStringsArray)) {
        // Called with prisma.raw\`\`
        const queryInstance = sqlTemplateTag.sqltag(
          stringOrTemplateStringsArray as any,
          ...values,
        )
        query = queryInstance[sqlOutput]
        parameters = {
          values: serializeRawParameters(queryInstance.values),
          __prismaRawParamaters__: true,
        }
      } else if ('string' === typeof stringOrTemplateStringsArray) {
        // Called with prisma.raw(string) or prisma.raw(string, values)
        query = stringOrTemplateStringsArray
        if (values.length) {
          parameters = {
            values: serializeRawParameters(values),
            __prismaRawParamaters__: true,
          }
        }
      } else {
        // called with prisma.raw(sql\`\`)
        query = stringOrTemplateStringsArray[sqlOutput]
        parameters = {
          values: serializeRawParameters(stringOrTemplateStringsArray.values),
          __prismaRawParamaters__: true,
        }
      }
      if (parameters?.values) {
        debug(`prisma.executeRaw(${query}, ${parameters.values})`)
      } else {
        debug(`prisma.executeRaw(${query})`)
      }

      const document = makeDocument({
        dmmf: this.dmmf,
        rootField: 'executeRaw',
        rootTypeName: 'mutation',
        select: {
          query,
          parameters,
        },
      })

      document.validate({ query, parameters }, false, 'raw', this.errorFormat)

      const docString = String(document)
      debug(`Generated request:`)
      debug(docString + '\n')

      return this.fetcher.request({
        document,
        rootField: 'executeRaw',
        typeName: 'executeRaw',
        isList: false,
        dataPath: [],
        clientMethod: 'executeRaw',
      })
    }

    /**
     * Executes a raw query. Always returns a number
     */
    async queryRaw(stringOrTemplateStringsArray, ...values) {
      let query = ''
      let parameters: any = undefined

      const sqlOutput =
        this.internalDatasources[0]?.connectorType === 'postgresql'
          ? 'text'
          : 'sql'

      debug(`Prisma Client call:`)
      if (Array.isArray(stringOrTemplateStringsArray)) {
        // Called with prisma.raw\`\`
        const queryInstance = sqlTemplateTag.sqltag(
          stringOrTemplateStringsArray as any,
          ...values,
        )
        query = queryInstance[sqlOutput]
        parameters = {
          values: serializeRawParameters(queryInstance.values),
          __prismaRawParamaters__: true,
        }
      } else if ('string' === typeof stringOrTemplateStringsArray) {
        // Called with prisma.raw(string) or prisma.raw(string, values)
        query = stringOrTemplateStringsArray
        if (values.length) {
          parameters = {
            values: serializeRawParameters(values),
            __prismaRawParamaters__: true,
          }
        }
      } else {
        // called with prisma.raw(sql\`\`)
        query = stringOrTemplateStringsArray[sqlOutput]
        parameters = {
          values: serializeRawParameters(stringOrTemplateStringsArray.values),
          __prismaRawParamaters__: true,
        }
      }
      if (parameters?.values) {
        debug(`prisma.queryRaw(${query}, ${parameters.values})`)
      } else {
        debug(`prisma.queryRaw(${query})`)
      }

      const document = makeDocument({
        dmmf: this.dmmf,
        rootField: 'queryRaw',
        rootTypeName: 'mutation',
        select: {
          query,
          parameters,
        },
      })

      document.validate({ query, parameters }, false, 'raw', this.errorFormat)

      const docString = String(document)
      debug(`Generated request:`)
      debug(docString + '\n')

      return this.fetcher.request({
        document,
        rootField: 'queryRaw',
        typeName: 'queryRaw',
        isList: false,
        dataPath: [],
        clientMethod: 'queryRaw',
      })
    }

    async __internal_triggerPanic(fatal: boolean) {
      if (!this.engineConfig.enableEngineDebugMode) {
        throw new Error(`In order to use .__internal_triggerPanic(), please enable the debug mode like so:
new PrismaClient({
  __internal: {
    engine: {
      enableEngineDebugMode: true
    }
  }
})`)
      }

      const query = 'SELECT 1'
      const parameters = {
        values: '',
        __prismaRawParameters__: true,
      }

      const document = makeDocument({
        dmmf: this.dmmf,
        rootField: 'executeRaw',
        rootTypeName: 'mutation',
        select: {
          query,
          parameters,
        },
      })

      document.validate({ query, parameters }, false, 'raw', this.errorFormat)

      const docString = String(document)
      debug(`Generated request:`)
      debug(docString + '\n')

      const headers: Record<string, string> = fatal
        ? { 'X-DEBUG-FATAL': '1' }
        : { 'X-DEBUG-NON-FATAL': '1' }

      return this.fetcher.request({
        document,
        rootField: 'executeRaw',
        typeName: 'executeRaw',
        isList: false,
        dataPath: [],
        clientMethod: 'executeRaw',
        headers,
      })
    }

    async transaction(promises: Array<any>): Promise<any> {
      if (config.generator?.experimentalFeatures?.includes('transactionApi')) {
        for (const p of promises) {
          if (
            !p.requestTransaction ||
            typeof p.requestTransaction !== 'function'
          ) {
            throw new Error(
              `All elements of the array need to be Prisma Client promises.`,
            )
          }
        }
        return Promise.all(promises.map((p) => p.requestTransaction()))
      } else {
        throw new Error(
          `In order to use the .transaction() api, please enable 'experimentalFeatures = "transactionApi" in your schema.`,
        )
      }
    }

    private bootstrapClient() {
      const clients = this.dmmf.mappings.reduce((acc, mapping) => {
        const lowerCaseModel = lowerCase(mapping.model)
        const model = this.dmmf.modelMap[mapping.model]

        if (!model) {
          throw new Error(`Invalid mapping ${mapping.model}, can't find model`)
        }

        const prismaClient = ({
          operation,
          actionName,
          rootField,
          args,
          dataPath,
          isList,
        }) => {
          dataPath = dataPath ?? []
          isList = isList ?? false

          const callsite =
            this.errorFormat !== 'minimal' ? new Error().stack : undefined
          const clientMethod = `${lowerCaseModel}.${actionName}`

          let document = makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: operation,
            select: args,
          })

          document.validate(
            args,
            false,
            `${lowerCaseModel}.${actionName}`,
            this.errorFormat,
            callsite,
          )

          document = transformDocument(document)

          const query = String(document)
          debug(`Prisma Client call:`)
          debug(
            `prisma.${clientMethod}(${printJsonWithErrors(args, [], [], [])})`,
          )
          debug(`Generated request:`)
          debug(query + '\n')

          let requestPromise: Promise<any>

          const collectTimestamps = new CollectTimestamps('PrismaClient')

          const showColors = this.errorFormat && this.errorFormat === 'pretty'

          const clientImplementation = {
            then: (onfulfilled, onrejected) => {
              if (!requestPromise) {
                requestPromise = this.fetcher.request({
                  document,
                  clientMethod,
                  typeName: mapping.model,
                  dataPath,
                  isList,
                  rootField,
                  collectTimestamps,
                  callsite,
                  showColors,
                })
              }

              return requestPromise.then(onfulfilled, onrejected)
            },
            requestTransaction: () => {
              if (!requestPromise) {
                requestPromise = this.fetcher.request({
                  document,
                  clientMethod,
                  typeName: mapping.model,
                  dataPath,
                  isList,
                  rootField,
                  collectTimestamps,
                  callsite,
                  runInTransaction: true,
                  showColors,
                })
              }

              return requestPromise
            },
            catch: (onrejected) => {
              if (!requestPromise) {
                requestPromise = this.fetcher.request({
                  document,
                  clientMethod,
                  typeName: mapping.model,
                  dataPath,
                  isList,
                  rootField,
                  collectTimestamps,
                  callsite,
                  showColors,
                })
              }

              return requestPromise.catch(onrejected)
            },
            finally: (onfinally) => {
              if (!requestPromise) {
                requestPromise = this.fetcher.request({
                  document,
                  clientMethod,
                  typeName: mapping.model,
                  dataPath,
                  isList,
                  rootField,
                  collectTimestamps,
                  callsite,
                  showColors,
                })
              }

              return requestPromise.finally(onfinally)
            },
            _collectTimestamps: collectTimestamps,
          }

          // add relation fields
          for (const field of model.fields.filter((f) => f.kind === 'object')) {
            clientImplementation[field.name] = (fieldArgs) => {
              const prefix = dataPath.includes('select')
                ? 'select'
                : dataPath.includes('include')
                ? 'include'
                : 'select'
              const newDataPath = [...dataPath, prefix, field.name]
              const newArgs = deepSet(args, newDataPath, fieldArgs || true)

              return clients[field.type]({
                operation,
                actionName,
                rootField,
                args: newArgs,
                dataPath: newDataPath,
                isList: field.isList,
              })
            }
          }

          return clientImplementation
        }

        acc[model.name] = prismaClient

        return acc
      }, {})

      for (const mapping of this.dmmf.mappings) {
        const lowerCaseModel = lowerCase(mapping.model)

        const denyList = {
          model: true,
          plural: true,
          aggregate: true,
        }

        const delegate: any = Object.entries(mapping).reduce(
          (acc, [actionName, rootField]) => {
            if (!denyList[actionName]) {
              const operation = getOperation(actionName as any)
              acc[actionName] = (args) =>
                clients[mapping.model]({
                  operation,
                  actionName,
                  rootField,
                  args,
                })
            }

            return acc
          },
          {},
        )

        delegate.count = (args) =>
          clients[mapping.model]({
            operation: 'query',
            actionName: 'count',
            rootField: mapping.aggregate,
            args: args
              ? {
                  select: { count: args },
                }
              : undefined,
            dataPath: ['count'],
          })

        this[lowerCaseModel] = delegate
      }
    }
  }

  return NewPrismaClient
}

export class PrismaClientFetcher {
  prisma: any
  debug: boolean
  hooks: any
  dataloader: Dataloader<{
    document: Document
    runInTransaction?: boolean
    headers?: Record<string, string>
  }>

  constructor(prisma, enableDebug = false, hooks?: any) {
    this.prisma = prisma
    this.debug = enableDebug
    this.hooks = hooks
    this.dataloader = new Dataloader({
      batchLoader: async (requests) => {
        const queries = requests.map((r) => String(r.document))
        await this.prisma.connect()
        const runTransaction = requests[0].runInTransaction
        return this.prisma.engine.requestBatch(queries, runTransaction)
      },
      singleLoader: async (request) => {
        const query = String(request.document)
        await this.prisma.connect()
        return this.prisma.engine.request(query, request.headers)
      },
      batchBy: (request) => {
        if (request.runInTransaction) {
          return 'transaction-batch'
        }

        if (!request.document.children[0].name.startsWith('findOne')) {
          return null
        }

        const selectionSet = request.document.children[0].children!.join(',')

        const args = request.document.children[0].args?.args
          .map((a) => {
            if (a.value instanceof Args) {
              return a.key + '-' + a.value.args.map((a) => a.key).join(',')
            }
            return a.key
          })
          .join(',')

        return `${request.document.children[0].name}|${args}|${selectionSet}`
      },
    })
  }

  async request({
    document,
    dataPath = [],
    rootField,
    typeName,
    isList,
    callsite,
    collectTimestamps,
    clientMethod,
    runInTransaction,
    showColors,
    headers,
  }: {
    document: Document
    dataPath: string[]
    rootField: string
    typeName: string
    isList: boolean
    clientMethod: string
    callsite?: string
    collectTimestamps?: CollectTimestamps
    runInTransaction?: boolean
    showColors?: boolean
    headers?: Record<string, string>
  }) {
    if (this.hooks && this.hooks.beforeRequest) {
      const query = String(document)
      this.hooks.beforeRequest({
        query,
        path: dataPath,
        rootField,
        typeName,
        document,
        isList,
      })
    }
    try {
      collectTimestamps && collectTimestamps.record('Pre-engine_request')
      const { data, elapsed } = await this.dataloader.request({
        document,
        runInTransaction,
        headers,
      })
      collectTimestamps && collectTimestamps.record('Post-engine_request')
      collectTimestamps && collectTimestamps.record('Pre-unpack')
      const unpackResult = this.unpack(document, data, dataPath, rootField)
      collectTimestamps && collectTimestamps.record('Post-unpack')
      collectTimestamps &&
        collectTimestamps.addResults({
          engine_request_rust: elapsed,
        })
      if (process.env.PRISMA_CLIENT_GET_TIME) {
        return { data: unpackResult, elapsed }
      }
      return unpackResult
    } catch (e) {
      let message = e.message
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: clientMethod,
          onUs: e.isPanic,
          showColors,
        })
        message = stack + '\n  ' + e.message
      }

      message = this.sanitizeMessage(message)
      if (e.code) {
        throw new PrismaClientKnownRequestError(message, e.code, e.meta)
      } else if (e.isPanic) {
        throw new PrismaClientRustPanicError(message)
      } else if (e instanceof PrismaClientUnknownRequestError) {
        throw new PrismaClientUnknownRequestError(message)
      } else if (e instanceof PrismaClientInitializationError) {
        throw new PrismaClientInitializationError(message)
      } else if (e instanceof PrismaClientRustPanicError) {
        throw new PrismaClientRustPanicError(message)
      }

      throw e
    }
  }
  sanitizeMessage(message) {
    if (this.prisma.errorFormat && this.prisma.errorFormat !== 'pretty') {
      return stripAnsi(message)
    }
    return message
  }
  unpack(document, data, path, rootField) {
    if (data.data) {
      data = data.data
    }
    const getPath: any[] = []
    if (rootField) {
      getPath.push(rootField)
    }
    getPath.push(...path.filter((p) => p !== 'select' && p !== 'include'))
    return unpack({ document, data, path: getPath })
  }
}

class CollectTimestamps {
  records: any[]
  start: any
  additionalResults: any
  constructor(startName) {
    this.records = []
    this.start = undefined
    this.additionalResults = {}
    this.start = { name: startName, value: process.hrtime() }
  }
  record(name) {
    this.records.push({ name, value: process.hrtime() })
  }
  elapsed(start, end) {
    const diff = [end[0] - start[0], end[1] - start[1]]
    const nanoseconds = diff[0] * 1e9 + diff[1]
    const milliseconds = nanoseconds / 1e6
    return milliseconds
  }
  addResults(results) {
    Object.assign(this.additionalResults, results)
  }
  getResults() {
    const results = this.records.reduce((acc, record) => {
      const name = record.name.split('-')[1]
      if (acc[name]) {
        acc[name] = this.elapsed(acc[name], record.value)
      } else {
        acc[name] = record.value
      }
      return acc
    }, {})
    Object.assign(results, {
      total: this.elapsed(
        this.start.value,
        this.records[this.records.length - 1].value,
      ),
      ...this.additionalResults,
    })
    return results
  }
}

export function getOperation(action: DMMF.ModelAction): 'query' | 'mutation' {
  if (
    action === DMMF.ModelAction.findMany ||
    action === DMMF.ModelAction.findOne
  ) {
    return 'query'
  }
  return 'mutation'
}
