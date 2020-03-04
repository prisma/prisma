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
import { Document, makeDocument, unpack, transformDocument } from './query'
import debugLib from 'debug'
const debug = debugLib('prisma-client')
import fs from 'fs'
import chalk from 'chalk'
import * as sqlTemplateTag from 'sql-template-tag'
import { parse as parseDotEnv } from 'dotenv'
import { GeneratorConfig } from '@prisma/generator-helper/dist/types'
import { getLogLevel } from './getLogLevel'
import { InternalDatasource } from './utils/printDatasources'
import { mergeBy } from './mergeBy'
import { lowerCase } from './utils/common'
import { deepSet } from './utils/deep-set'
import { Dataloader } from './Dataloader'
import { printStack } from './utils/printStack'
import stripAnsi from 'strip-ansi'
import { PrismaClientValidationError } from '../__tests__/runtime-tests/new-line/@prisma/client'

export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'

export type Datasources = any

export interface PrismaClientOptions {
  datasources?: Datasources

  /**
   * @default "pretty"
   */
  errorFormat?: ErrorFormat

  log?: Array<LogLevel | LogDefinition>

  /**
   * You probably don't want to use this. \`__internal\` is used by internal tooling.
   */
  __internal?: {
    debug?: boolean
    hooks?: Hooks
    engine?: {
      cwd?: string
      binaryPath?: string
    }
    measurePerformance?: boolean
  }

  /**
   * Useful for pgbouncer
   */
  forceTransactions?: boolean
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
export type LogLevel = 'info' | 'query' | 'warn'
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
  datasources: InternalDatasource[]
  version?: string
  generator?: GeneratorConfig
  platforms?: string[]
  sqliteDatasourceOverrides?: DatasourceOverwrite[]
  relativePath: string
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
    private errorFormat: ErrorFormat
    private measurePerformance: boolean
    constructor(optionsArg?: PrismaClientOptions) {
      const options: PrismaClientOptions = optionsArg ?? {}
      const internal = options.__internal ?? {}

      const useDebug = internal.debug === true
      if (useDebug) {
        debugLib.enable('prisma-client')
      }

      let predefinedDatasources = config.sqliteDatasourceOverrides ?? []
      predefinedDatasources = predefinedDatasources.map(d => ({
        name: d.name,
        url: 'file:' + path.resolve(__dirname, d.url),
      }))

      const inputDatasources = Object.entries(
        options.datasources || {},
      ).map(([name, url]: any) => ({ name, url }))

      const datasources = mergeBy(
        predefinedDatasources,
        inputDatasources,
        source => source.name,
      )

      const engineConfig = internal.engine || {}

      if (options.errorFormat) {
        this.errorFormat = options.errorFormat
      } else if (process.env.NODE_ENV === 'production') {
        this.errorFormat = 'minimal'
      } else if (process.env.NO_COLOR) {
        this.errorFormat = 'colorless'
      } else {
        this.errorFormat = 'pretty'
      }

      this.measurePerformance = internal.measurePerformance || false

      const envFile = this.readEnv()

      this.dmmf = new DMMFClass(config.document)

      const cwd = path.resolve(__dirname, config.relativePath)

      if (!fs.existsSync(cwd)) {
        throw new Error(`Tried to start in ${cwd} but that path doesn't exist`)
      }

      this.engineConfig = {
        cwd,
        debug: useDebug,
        datamodelPath: path.join(cwd, 'schema.prisma'),
        prismaPath: engineConfig.binaryPath ?? undefined,
        datasources,
        generator: config.generator,
        showColors: this.errorFormat === 'pretty',
        logLevel: options.log && (getLogLevel(options.log) as any), // TODO
        logQueries:
          options.log &&
          Boolean(
            typeof options.log === 'string'
              ? options.log === 'query'
              : options.log.find(o =>
                  typeof o === 'string' ? o === 'query' : o.level === 'query',
                ),
          ),
        env: envFile,
        flags: options.forceTransactions ? ['--always_force_transactions'] : [],
      }

      this.engine = new NodeEngine(this.engineConfig)
      this.fetcher = new PrismaClientFetcher(this, false)

      if (options.log) {
        for (const log of options.log) {
          const level =
            typeof log === 'string'
              ? log
              : log.emit === 'stdout'
              ? log.level
              : null
          if (level) {
            this.on(level, event => {
              const colorMap = {
                query: 'blue',
                info: 'cyan',
                warn: 'yellow',
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
      const dotEnvPath = path.resolve(__dirname, config.relativePath, '.env')
      if (fs.existsSync(dotEnvPath)) {
        return parseDotEnv(fs.readFileSync(dotEnvPath, 'utf-8'))
      }

      return {}
    }
    on(eventType: any, callback: (event: any) => void) {
      this.engine.on(eventType, event => {
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
          // warn or info events
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
      this.connectionPromise = this.engine.start()
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
     * Makes a raw query
     */

    async raw(stringOrTemplateStringsArray, ...values) {
      let query = ''
      let parameters: any = undefined

      if (Array.isArray(stringOrTemplateStringsArray)) {
        // Called with prisma.raw\`\`
        const queryInstance = sqlTemplateTag.sqltag(
          stringOrTemplateStringsArray as any,
          ...values,
        )
        query = queryInstance.sql
        parameters = JSON.stringify(queryInstance.values)
      } else {
        // Called with prisma.raw(string)
        query = stringOrTemplateStringsArray
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

      return this.fetcher.request({
        document,
        rootField: 'executeRaw',
        typeName: 'raw',
        isList: false,
        dataPath: [],
        clientMethod: 'raw',
      })
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

          const callsite = new Error().stack
          const clientMethod = `${lowerCaseModel}.${actionName}`

          let document = makeDocument({
            dmmf: this.dmmf,
            rootField,
            rootTypeName: operation,
            select: args,
          })

          try {
            document.validate(
              args,
              false,
              `${lowerCaseModel}.${actionName}`,
              /* errorFormat */ undefined,
            )
          } catch (e) {
            const { stack } = printStack({
              callsite,
              originalMethod: clientMethod,
              onUs: false,
            })
            throw new PrismaClientValidationError(stack + e.message)
          }

          document = transformDocument(document)

          let requestPromise: Promise<any>

          const collectTimestamps = new CollectTimestamps('PrismaClient')

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
                })
              }

              return requestPromise.then(onfulfilled, onrejected)
            },
            catch: onrejected => {
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
                })
              }

              return requestPromise.catch(onrejected)
            },
            finally: onfinally => {
              if (!requestPromise) {
                requestPromise = this.fetcher.request({
                  document,
                  clientMethod,
                  typeName: mapping.model,
                  dataPath,
                  isList: true,
                  rootField,
                  collectTimestamps,
                  callsite,
                })
              }

              return requestPromise.finally(onfinally)
            },
            _collectTimestamps: collectTimestamps,
          }

          // add relation fields
          for (const field of model.fields.filter(f => f.kind === 'object')) {
            clientImplementation[field.name] = fieldArgs => {
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

        const delegate = Object.entries(mapping).reduce(
          (acc, [actionName, rootField]) => {
            if (!denyList[actionName]) {
              const operation = getOperation(actionName as any)
              acc[actionName] = args =>
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

        this[lowerCaseModel] = delegate
      }
    }
  }

  return NewPrismaClient
}

class PrismaClientFetcher {
  prisma: any
  debug: boolean
  hooks: any
  dataloader: Dataloader
  constructor(prisma, enableDebug = false, hooks?: any) {
    this.prisma = prisma
    this.debug = enableDebug
    this.hooks = hooks
    this.dataloader = new Dataloader(async requests => {
      // TODO: More elaborate logic to only batch certain queries together
      // We should e.g. make sure, that findOne queries are batched together
      await this.prisma.connect()
      const queries = requests.map(r => {
        const str = String(r.document)
        debug(str)
        return str
      })
      return this.prisma.engine.request(queries)
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
  }: {
    document: Document
    dataPath: string[]
    rootField: string
    typeName: string
    isList: boolean
    clientMethod: string
    callsite?: string
    collectTimestamps?: any
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
      const result = await this.dataloader.request({ document })
      collectTimestamps && collectTimestamps.record('Post-engine_request')
      collectTimestamps && collectTimestamps.record('Pre-unpack')
      const unpackResult = this.unpack(document, result, dataPath, rootField)
      collectTimestamps && collectTimestamps.record('Post-unpack')
      return unpackResult
    } catch (e) {
      if (callsite) {
        const { stack } = printStack({
          callsite,
          originalMethod: clientMethod,
          onUs: e.isPanic,
        })
        const message = stack + e.message
        if (e.code) {
          throw new PrismaClientKnownRequestError(
            this.sanitizeMessage(message),
            e.code,
            e.meta,
          )
        }
        if (e instanceof PrismaClientUnknownRequestError) {
          throw new PrismaClientUnknownRequestError(
            this.sanitizeMessage(message),
          )
        } else if (e instanceof PrismaClientInitializationError) {
          throw new PrismaClientInitializationError(
            this.sanitizeMessage(message),
          )
        } else if (e instanceof PrismaClientRustPanicError) {
          throw new PrismaClientRustPanicError(this.sanitizeMessage(message))
        }
      } else {
        if (e.code) {
          throw new PrismaClientKnownRequestError(
            this.sanitizeMessage(e.message),
            e.code,
            e.meta,
          )
        }
        if (e.isPanic) {
          throw new PrismaClientRustPanicError(e.message)
        } else {
          if (e instanceof PrismaClientUnknownRequestError) {
            throw new PrismaClientUnknownRequestError(
              this.sanitizeMessage(e.message),
            )
          } else if (e instanceof PrismaClientInitializationError) {
            throw new PrismaClientInitializationError(
              this.sanitizeMessage(e.message),
            )
          } else if (e instanceof PrismaClientRustPanicError) {
            throw new PrismaClientRustPanicError(
              this.sanitizeMessage(e.message),
            )
          }
        }
      }
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
    getPath.push(...path.filter(p => p !== 'select' && p !== 'include'))
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
