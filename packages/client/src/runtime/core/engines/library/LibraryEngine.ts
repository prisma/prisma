import Debug from '@prisma/debug'
import { ErrorRecord } from '@prisma/driver-adapter-utils'
import type { BinaryTarget } from '@prisma/get-platform'
import { assertNodeAPISupported, binaryTargets, getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import { assertAlways, EngineSpanEvent } from '@prisma/internals'
import { bold, green, red, yellow } from 'kleur/colors'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { PrismaClientKnownRequestError } from '../../errors/PrismaClientKnownRequestError'
import { PrismaClientRustPanicError } from '../../errors/PrismaClientRustPanicError'
import { PrismaClientUnknownRequestError } from '../../errors/PrismaClientUnknownRequestError'
import { prismaGraphQLToJSError } from '../../errors/utils/prismaGraphQLToJSError'
import type { BatchQueryEngineResult, EngineConfig, RequestBatchOptions, RequestOptions } from '../common/Engine'
import { Engine } from '../common/Engine'
import { LogEmitter, LogEventType } from '../common/types/Events'
import { JsonFieldSelection, JsonQuery } from '../common/types/JsonProtocol'
import { EngineMetricsOptions, Metrics, MetricsOptionsJson, MetricsOptionsPrometheus } from '../common/types/Metrics'
import type {
  QueryEngineEvent,
  QueryEngineLogLevel,
  QueryEnginePanicEvent,
  QueryEngineQueryEvent,
  RustRequestError,
  SyncRustError,
} from '../common/types/QueryEngine'
import { RequestError } from '../common/types/RequestError'
import type * as Tx from '../common/types/Transaction'
import { getBatchRequestPayload } from '../common/utils/getBatchRequestPayload'
import { getErrorMessageWithLink as genericGetErrorMessageWithLink } from '../common/utils/getErrorMessageWithLink'
import { getInteractiveTransactionId } from '../common/utils/getInteractiveTransactionId'
import { defaultLibraryLoader } from './DefaultLibraryLoader'
import { reactNativeLibraryLoader } from './ReactNativeLibraryLoader'
import type { Library, LibraryLoader, QueryEngineConstructor, QueryEngineInstance } from './types/Library'
import { wasmLibraryLoader } from './WasmLibraryLoader'

const DRIVER_ADAPTER_EXTERNAL_ERROR = 'P2036'
const debug = Debug('prisma:client:libraryEngine')

function isQueryEvent(event: QueryEngineEvent): event is QueryEngineQueryEvent {
  return event['item_type'] === 'query' && 'query' in event
}
function isPanicEvent(event: QueryEngineEvent): event is QueryEnginePanicEvent {
  if ('level' in event) {
    return event.level === 'error' && event['message'] === 'PANIC'
  } else {
    return false
  }
}

const knownBinaryTargets: BinaryTarget[] = [...binaryTargets, 'native']
let engineInstanceCount = 0

export class LibraryEngine implements Engine<undefined> {
  name = 'LibraryEngine' as const
  engine?: QueryEngineInstance
  libraryInstantiationPromise?: Promise<void>
  libraryStartingPromise?: Promise<void>
  libraryStoppingPromise?: Promise<void>
  libraryStarted: boolean
  executingQueryPromise?: Promise<any>
  config: EngineConfig
  QueryEngineConstructor?: QueryEngineConstructor
  libraryLoader: LibraryLoader
  library?: Library
  logEmitter: LogEmitter
  libQueryEnginePath?: string
  binaryTarget?: BinaryTarget
  datasourceOverrides?: Record<string, string>
  datamodel: string
  logQueries: boolean
  logLevel: QueryEngineLogLevel
  lastQuery?: string
  loggerRustPanic?: any

  versionInfo?: {
    commit: string
    version: string
  }
  adapter: any

  constructor(config: EngineConfig, libraryLoader?: LibraryLoader) {
    if (TARGET_BUILD_TYPE === 'react-native') {
      this.libraryLoader = reactNativeLibraryLoader
    } else if (TARGET_BUILD_TYPE === 'library') {
      this.libraryLoader = libraryLoader ?? defaultLibraryLoader

      // this can only be true if PRISMA_CLIENT_FORCE_WASM=true
      if (config.engineWasm !== undefined) {
        this.libraryLoader = libraryLoader ?? wasmLibraryLoader
      }
    } else if (TARGET_BUILD_TYPE === 'wasm') {
      this.libraryLoader = libraryLoader ?? wasmLibraryLoader
    } else {
      throw new Error(`Invalid TARGET_BUILD_TYPE: ${TARGET_BUILD_TYPE}`)
    }

    // console.log({config})
    this.config = config
    this.libraryStarted = false
    this.logQueries = config.logQueries ?? false
    this.logLevel = config.logLevel ?? 'error'
    this.logEmitter = config.logEmitter
    this.datamodel = config.inlineSchema

    if (config.enableDebugLogs) {
      this.logLevel = 'debug'
    }

    // compute the datasource override for library engine
    const dsOverrideName = Object.keys(config.overrideDatasources)[0]
    const dsOverrideUrl = config.overrideDatasources[dsOverrideName]?.url
    if (dsOverrideName !== undefined && dsOverrideUrl !== undefined) {
      this.datasourceOverrides = { [dsOverrideName]: dsOverrideUrl }
    }

    this.libraryInstantiationPromise = this.instantiateLibrary()

    this.checkForTooManyEngines()
  }

  private checkForTooManyEngines() {
    // We don't show this warning for Edge Functions,
    // see https://github.com/prisma/team-orm/issues/1094.
    if (this.config.adapter && ['wasm'].includes(TARGET_BUILD_TYPE)) {
      return
    }

    if (engineInstanceCount === 10) {
      console.warn(
        `${yellow(
          'warn(prisma-client)',
        )} This is the 10th instance of Prisma Client being started. Make sure this is intentional.`,
      )
    }
  }

  async applyPendingMigrations(): Promise<void> {
    if (TARGET_BUILD_TYPE === 'react-native') {
      await this.start()
      await this.engine?.applyPendingMigrations()
    } else {
      throw new Error('Cannot call this method from this type of engine instance')
    }
  }

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

    const headerStr = JSON.stringify(headers)

    let result: string | undefined
    if (action === 'start') {
      const jsonOptions = JSON.stringify({
        max_wait: arg.maxWait,
        timeout: arg.timeout,
        isolation_level: arg.isolationLevel,
      })

      result = await this.engine?.startTransaction(jsonOptions, headerStr)
    } else if (action === 'commit') {
      result = await this.engine?.commitTransaction(arg.id, headerStr)
    } else if (action === 'rollback') {
      result = await this.engine?.rollbackTransaction(arg.id, headerStr)
    }

    const response = this.parseEngineResponse<{ [K: string]: unknown }>(result)

    if (isUserFacingError(response)) {
      const externalError = this.getExternalAdapterError(response)
      if (externalError) {
        throw externalError.error
      }
      throw new PrismaClientKnownRequestError(response.message, {
        code: response.error_code as string,
        clientVersion: this.config.clientVersion as string,
        meta: response.meta,
      })
    }

    return response as Tx.InteractiveTransactionInfo<undefined> | undefined
  }

  private async instantiateLibrary(): Promise<void> {
    debug('internalSetup')
    if (this.libraryInstantiationPromise) {
      return this.libraryInstantiationPromise
    }

    if (TARGET_BUILD_TYPE === 'library') {
      assertNodeAPISupported()
    }

    this.binaryTarget = await this.getCurrentBinaryTarget()

    await this.loadEngine()

    this.version()
  }

  private async getCurrentBinaryTarget() {
    if (TARGET_BUILD_TYPE === 'library') {
      if (this.binaryTarget) return this.binaryTarget
      const binaryTarget = await getBinaryTargetForCurrentPlatform()
      if (!knownBinaryTargets.includes(binaryTarget)) {
        throw new PrismaClientInitializationError(
          `Unknown ${red('PRISMA_QUERY_ENGINE_LIBRARY')} ${red(bold(binaryTarget))}. Possible binaryTargets: ${green(
            knownBinaryTargets.join(', '),
          )} or a path to the query engine library.
You may have to run ${green('prisma generate')} for your changes to take effect.`,
          this.config.clientVersion!,
        )
      }

      return binaryTarget
    }

    return undefined
  }

  private parseEngineResponse<T>(response?: string): T {
    if (!response) {
      throw new PrismaClientUnknownRequestError(`Response from the Engine was empty`, {
        clientVersion: this.config.clientVersion!,
      })
    }
    try {
      const config = JSON.parse(response)
      return config as T
    } catch (err) {
      throw new PrismaClientUnknownRequestError(`Unable to JSON.parse response from engine ${err} ${response}`, {
        clientVersion: this.config.clientVersion!,
      })
    }
  }

  private async loadEngine(): Promise<void> {
    if (this.engine) {
      return
    }

    if (!this.QueryEngineConstructor) {
      this.library = await this.libraryLoader.loadLibrary(this.config)
      this.QueryEngineConstructor = this.library.QueryEngine
    }
    try {
      // Using strong reference to `this` inside of log callback will prevent
      // this instance from being GCed while native engine is alive. At the
      // same time, `this.engine` field will prevent native instance from
      // being GCed. Using weak ref helps to avoid this cycle
      const weakThis = new WeakRef(this)
      const { adapter } = this.config

      if (adapter) {
        debug('Using driver adapter: %O', adapter)
        this.adapter = adapter
      }

      this.engine = new this.QueryEngineConstructor(
        {
          datamodel: this.datamodel,
          env: process.env,
          logQueries: this.config.logQueries ?? false,
          ignoreEnvVarErrors: true,
          datasourceOverrides: this.datasourceOverrides ?? {},
          logLevel: this.logLevel,
          configDir: this.config.cwd,
          engineProtocol: 'json',
        },
        (log) => {
          weakThis.deref()?.logger(log)
        },
        adapter,
      )
      engineInstanceCount++
    } catch (_e) {
      const e = _e as Error
      const error = this.parseInitError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
      }
    }
  }

  private logger(log: string) {
    const event = this.parseEngineResponse<QueryEngineEvent | null>(log)
    if (!event) return

    if ('span' in event) {
      void this.config.tracingHelper.createEngineSpan(event as EngineSpanEvent)

      return
    }

    event.level = event?.level.toLowerCase() ?? 'unknown'
    if (isQueryEvent(event)) {
      this.logEmitter.emit('query', {
        timestamp: new Date(),
        query: event.query,
        params: event.params,
        duration: Number(event.duration_ms),
        target: event.module_path,
      })
    } else if (isPanicEvent(event) && TARGET_BUILD_TYPE !== 'wasm') {
      // The error built is saved to be thrown later
      this.loggerRustPanic = new PrismaClientRustPanicError(
        getErrorMessageWithLink(
          this,
          `${event.message}: ${event.reason} in ${event.file}:${event.line}:${event.column}`,
        ),
        this.config.clientVersion!,
      )
    } else {
      this.logEmitter.emit(event.level as LogEventType, {
        timestamp: new Date(),
        message: event.message,
        target: event.module_path,
      })
    }
  }

  private parseInitError(str: string): SyncRustError | string {
    try {
      const error = JSON.parse(str)
      return error
    } catch (e) {
      //
    }
    return str
  }

  private parseRequestError(str: string): RustRequestError | string {
    try {
      const error = JSON.parse(str)
      return error
    } catch (e) {
      //
    }
    return str
  }

  onBeforeExit() {
    throw new Error(
      '"beforeExit" hook is not applicable to the library engine since Prisma 5.0.0, it is only relevant and implemented for the binary engine. Please add your event listener to the `process` object directly instead.',
    )
  }

  async start(): Promise<void> {
    await this.libraryInstantiationPromise
    await this.libraryStoppingPromise

    if (this.libraryStartingPromise) {
      debug(`library already starting, this.libraryStarted: ${this.libraryStarted}`)
      return this.libraryStartingPromise
    }

    if (this.libraryStarted) {
      return
    }

    const startFn = async () => {
      debug('library starting')

      try {
        const headers = {
          traceparent: this.config.tracingHelper.getTraceParent(),
        }

        await this.engine?.connect(JSON.stringify(headers))

        this.libraryStarted = true

        debug('library started')
      } catch (err) {
        const error = this.parseInitError(err.message as string)

        // The error message thrown by the query engine should be a stringified JSON
        // if parsing fails then we just reject the error
        if (typeof error === 'string') {
          throw err
        } else {
          throw new PrismaClientInitializationError(error.message, this.config.clientVersion!, error.error_code)
        }
      } finally {
        this.libraryStartingPromise = undefined
      }
    }

    this.libraryStartingPromise = this.config.tracingHelper.runInChildSpan('connect', startFn)

    return this.libraryStartingPromise
  }

  async stop(): Promise<void> {
    await this.libraryStartingPromise
    await this.executingQueryPromise

    if (this.libraryStoppingPromise) {
      debug('library is already stopping')
      return this.libraryStoppingPromise
    }

    if (!this.libraryStarted) {
      return
    }

    const stopFn = async () => {
      await new Promise((r) => setTimeout(r, 5))

      debug('library stopping')

      const headers = {
        traceparent: this.config.tracingHelper.getTraceParent(),
      }

      await this.engine?.disconnect(JSON.stringify(headers))

      this.libraryStarted = false
      this.libraryStoppingPromise = undefined

      debug('library stopped')
    }

    this.libraryStoppingPromise = this.config.tracingHelper.runInChildSpan('disconnect', stopFn)

    return this.libraryStoppingPromise
  }

  version(): string {
    this.versionInfo = this.library?.version()
    return this.versionInfo?.version ?? 'unknown'
  }
  /**
   * Triggers an artificial panic
   */
  debugPanic(message?: string): Promise<never> {
    return this.library?.debugPanic(message) as Promise<never>
  }

  async request<T>(
    query: JsonQuery,
    { traceparent, interactiveTransaction }: RequestOptions<undefined>,
  ): Promise<{ data: T; elapsed: number }> {
    debug(`sending request, this.libraryStarted: ${this.libraryStarted}`)
    // console.log('this is the json ', query)

    const headerStr = JSON.stringify({ traceparent }) // object equivalent to http headers for the library
    const queryStr = JSON.stringify(query)

    try {
      await this.start()

      let data: any = {}

      // console.dir({ query }, { depth: null })
      if (
        !interactiveTransaction?.id && // No support for interactive transactions yet as long as we can not handle all queries
        this.adapter && // trigger only for driverAdapters
        // query.modelName == 'User' // trigger only for model User
        query.action == 'findMany' &&
        // arguments = {}
        Object.keys(query.query.arguments!).length == 0 &&
        // selection = { '$composites': true, '$scalars': true }
        query.query.selection.$composites === true &&
        query.query.selection.$scalars === true
        // && !query.query.selection._count /* _count: { arguments: {}, selection: { links: true } } */

        // && query.modelName == 'foobar' // comment in this line if you just want to skip the NodeEngine completely
      ) {
        // console.log('Yes, NodeEngine!')
        // console.dir({ query }, { depth: null })

        const getModelFieldDefinitionByFieldX = (x, modelFields, resultFieldX) => {
          // console.log('getModelFieldDefinitionByFieldX by ', x, ' for ', resultFieldX)
          for (const modelField in modelFields) {
            if (Object.prototype.hasOwnProperty.call(modelFields, modelField)) {
              // console.log('-', modelField, modelFields[modelField])

              if (modelFields[modelField][x] == resultFieldX) {
                // console.log('modelFieldDefinition found: ', modelFields[modelField])
                return modelFields[modelField]
              }
            }
          }
        }
        const getModelFieldDefinitionByFieldName = (modelFields, resultFieldName) => {
          return getModelFieldDefinitionByFieldX('name', modelFields, resultFieldName)
        }
        const getModelFieldDefinitionByFieldRelatioName = (modelFields, resultFieldRelationName) => {
          return getModelFieldDefinitionByFieldX('relationName', modelFields, resultFieldRelationName)
        }
        const getModelFieldDefinitionByFieldDbName = (modelFields, resultFieldDbName) => {
          return getModelFieldDefinitionByFieldX('dbName', modelFields, resultFieldDbName)
        }
        const getModelFieldDefinitionByFieldIsId = (modelFields) => {
          return getModelFieldDefinitionByFieldX('isId', modelFields, true)
        }

        // "dmmf" like object that has information about datamodel
        // console.dir({ _runtimeDataModel: this.config._runtimeDataModel }, { depth: null })

        this.executingQueryPromise = (async () => {
          // get table name via "dmmf"
          const modelName = query.modelName
          const tableName = this.config._runtimeDataModel.models[modelName!].dbName || modelName // dbName == @@map
          // console.log({tableName})

          // get table fields
          // TODO consider @map
          const modelFields = this.config._runtimeDataModel.models[modelName!].fields
          // console.log({modelFields})

          let sql = ''
          if (query.query.selection._count) {
            /*
              model Link {
                id        String   @id @default(uuid())
                user      User?    @relation(fields: [userId], references: [id])
                userId    String?
              }
              model User {
                id        String    @id @default(uuid())
                links     Link[]
              }

              =>
              _count: { arguments: {}, selection: { links: true } }
            */

            const selections = Object.keys((query.query.selection._count as JsonFieldSelection).selection)

            // arrays to store generated data to add to the SQL statement
            const _additionalSelections: String[] = []
            const _additionalJoins: String[] = []

            // loop over all selections
            // const relationToCount = selections[0] // 'links`
            for (let i = 0; i < selections.length; i++) {
              const relationToCount = selections[i]
              // get information from current model
              const relationToCountFieldDefinition = getModelFieldDefinitionByFieldName(modelFields, relationToCount) // links object
              // console.log({relationToCountFieldDefinition})

              // PART 1: additional selection string
              const relationToCountModelname = relationToCountFieldDefinition.type // 'Link'
              const relationToCountTablename = relationToCountModelname // TODO Actually get the table name for target model, not just the type of the relation
              const _selectionString = `COALESCE("aggr_selection_${i}_${relationToCountTablename}"."_aggr_count_${relationToCount}", 0) AS "_aggr_count_${relationToCount}"`
              _additionalSelections.push(_selectionString)

              // PART 2: additional JOIN
              // get information from model the relation points to
              const relationToCountModelFields = this.config._runtimeDataModel.models[relationToCountModelname!].fields
              // console.dir({ relationToCountModelname, relationToCountModelFields }, { depth: null })
              const targetModelFieldDefinition = getModelFieldDefinitionByFieldRelatioName(
                relationToCountModelFields,
                relationToCountFieldDefinition.relationName,
              )
              const aggregationTargetType = targetModelFieldDefinition.type // 'User'
              const relationFromField = targetModelFieldDefinition.relationFromFields[0] // this only has content for 1-n, not m-n
              // console.log({ relationFromField })

              // primary key from first table for sql
              const aggregationTargetTypeIdField = getModelFieldDefinitionByFieldIsId(modelFields)
              // console.log({ aggregationTargetTypeIdField })
              const aggregationTargetTypeIdFieldName = aggregationTargetTypeIdField.name // User.uid
              // console.log( { aggregationTargetTypeIdFieldName })

              if (relationFromField) {
                // 1-n
                const _joinString = `LEFT JOIN
                        (SELECT "${relationToCountTablename}"."${relationFromField}",
                                COUNT(*) AS "_aggr_count_${relationToCount}"
                        FROM "${relationToCountTablename}"
                        WHERE 1=1
                        GROUP BY "${relationToCountTablename}"."${relationFromField}") 
                          AS "aggr_selection_${i}_${relationToCountTablename}" 
                          ON ("${aggregationTargetType}".${aggregationTargetTypeIdFieldName} = "aggr_selection_${i}_${relationToCountTablename}"."${relationFromField}")
                  `
                _additionalJoins.push(_joinString)
              } else {
                // m-n

                // need to get the primary key so we can properly join
                const relationToCountTypeIdField = getModelFieldDefinitionByFieldIsId(relationToCountModelFields) // User details
                console.log({ relationToCountTypeIdField })
                const relationToCountTypeIdFieldName = relationToCountTypeIdField.name // User.uid
                console.log({ relationToCountTypeIdFieldName })

                // Correctly select A and B to match model/table names of relation
                const char1 = relationToCountTablename.charAt(0)
                const char2 = tableName.charAt(0)
                const [mainForeignKeyName, otherForeignKeyName] =
                  char1.charCodeAt(0) < char2.charCodeAt(0) ? ['B', 'A'] : ['A', 'B']

                const _joinString = `
                      LEFT JOIN
                        (SELECT "_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}",
                                COUNT(("_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}")) AS "_aggr_count_${relationToCount}"
                          FROM "${relationToCountTablename}"
                          LEFT JOIN "_${relationToCountFieldDefinition.relationName}" ON ("${relationToCountTablename}"."${relationToCountTypeIdFieldName}" = ("_${relationToCountFieldDefinition.relationName}"."${otherForeignKeyName}"))
                          WHERE 1=1
                          GROUP BY "_${relationToCountFieldDefinition.relationName}"."${mainForeignKeyName}") 
                            AS "aggr_selection_${i}_${relationToCountTablename}" 
                            ON ("${aggregationTargetType}"."${aggregationTargetTypeIdFieldName}" = "aggr_selection_${i}_${relationToCountTablename}"."${mainForeignKeyName}")
                `
                _additionalJoins.push(_joinString)
              }
              sql = `SELECT "${tableName}".*, 
                            ${_additionalSelections.join(',\n')}
                      FROM "${tableName}"
                      ${_additionalJoins.join('\n')}
                      WHERE 1=1
                        OFFSET 0`
            }
          } else {
            sql = `SELECT * FROM "${tableName}"`
          }
          // console.log({sql})

          try {
            const result = await this.adapter.queryRaw({ sql, args: [] })
            // console.dir({ result }, { depth: null })

            // LOG SQL
            if (this.logQueries) {
              this.logEmitter.emit('query', {
                timestamp: new Date(),
                query: sql,
                params: 'none', // TODO params
                duration: Number(0), // TODO measure above
                target: 'huh?', // TODO what is this even?
              })
              console.log('nodeQuery', sql)
            }

            // INTERNAL: combine separated keys and values from driver adapter
            const combinedResult = result.value.rows.map((row) => {
              const obj = {}
              result.value.columnNames.forEach((colName, index) => {
                obj[colName] = row[index]
              })
              return obj
            })
            // console.log({combinedResult})

            // RESULT VALUE TYPE INDICATION
            // turn returned data into expected format (with type indications for casting in /packages/client/src/runtime/core/jsonProtocol/deserializeJsonResponse.ts)
            // TODO Long term most of this should not be necessary at all, as it is just from a to b and then back to a
            let transformedData = combinedResult.map((resultRow) => {
              // iterate over all fields of the row
              for (const resultFieldName in resultRow) {
                if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
                  // console.dir(`${resultFieldName}: ${resultRow[resultFieldName]}`);

                  const modelFieldDefinition = getModelFieldDefinitionByFieldName(modelFields, resultFieldName)
                  if (modelFieldDefinition) {
                    const type = modelFieldDefinition.type
                    if (resultRow[resultFieldName] != null) {
                      // field is not empty
                      if (type == 'DateTime') {
                        resultRow[resultFieldName] = { $type: 'DateTime', value: resultRow[resultFieldName] }
                      } else if (type == 'BigInt') {
                        resultRow[resultFieldName] = { $type: 'BigInt', value: resultRow[resultFieldName] }
                      } else if (type == 'Bytes') {
                        resultRow[resultFieldName] = { $type: 'Bytes', value: resultRow[resultFieldName] }
                      } else if (type == 'Decimal') {
                        resultRow[resultFieldName] = { $type: 'Decimal', value: resultRow[resultFieldName] }
                      }
                    }
                  }
                }
              }

              return resultRow
            })

            // TRANSFORM AGGREGATIONS
            // console.log("data before transformation", transformedData)
            transformedData = transformedData.map((resultRow) => {
              for (const resultFieldName in resultRow) {
                if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
                  // console.dir(`${resultFieldName}: ${resultRow[resultFieldName]}`);

                  // _count
                  if (resultFieldName.startsWith('_aggr_count_')) {
                    const countKey = resultFieldName.replace('_aggr_count_', '')
                    if (!resultRow._count) {
                      resultRow._count = {}
                    }
                    resultRow._count[countKey] = Number(resultRow[resultFieldName])
                    delete resultRow[resultFieldName]
                  }
                }
              }
              return resultRow
            })
            // console.log("data before transformation", transformedData)

            // @map FIELD RENAMING
            // console.log({ modelFields })
            transformedData = transformedData.map((resultRow) => {
              for (const resultFieldName in resultRow) {
                if (Object.prototype.hasOwnProperty.call(resultRow, resultFieldName)) {
                  // console.dir(`${key}: ${row[key]}`);

                  const modelFieldDefinition = getModelFieldDefinitionByFieldDbName(modelFields, resultFieldName)
                  // console.log({ modelFieldDefinition })
                  if (modelFieldDefinition && modelFieldDefinition.name) {
                    // TODO do this in a way that the order of fields is not changed
                    resultRow[modelFieldDefinition.name] = resultRow[resultFieldName]
                    delete resultRow[resultFieldName]
                  }
                }
              }
              return resultRow
            })

            return transformedData
          } catch (error) {
            throw new Error(error)
          }
        })()

        this.lastQuery = queryStr
        const engineResponse = await this.executingQueryPromise
        // console.log({ engineResponse })
        data = [engineResponse]
      } else {
        this.executingQueryPromise = this.engine?.query(queryStr, headerStr, interactiveTransaction?.id)

        this.lastQuery = queryStr
        const engineResponse = await this.executingQueryPromise
        // console.log({ engineResponse })
        data = this.parseEngineResponse<any>(engineResponse)
      }

      if (data.errors) {
        if (data.errors.length === 1) {
          throw this.buildQueryError(data.errors[0])
        }
        // this case should not happen, as the query engine only returns one error
        throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), {
          clientVersion: this.config.clientVersion!,
        })
      } else if (this.loggerRustPanic) {
        throw this.loggerRustPanic
      }
      // TODO Implement Elapsed: https://github.com/prisma/prisma/issues/7726
      // console.dir({ data }, { depth: null })
      return { data, elapsed: 0 }
    } catch (e: any) {
      if (e instanceof PrismaClientInitializationError) {
        throw e
      }
      if (e.code === 'GenericFailure' && e.message?.startsWith('PANIC:') && TARGET_BUILD_TYPE !== 'wasm') {
        throw new PrismaClientRustPanicError(getErrorMessageWithLink(this, e.message), this.config.clientVersion!)
      }
      const error = this.parseRequestError(e.message)
      if (typeof error === 'string') {
        throw e
      } else {
        throw new PrismaClientUnknownRequestError(`${error.message}\n${error.backtrace}`, {
          clientVersion: this.config.clientVersion!,
        })
      }
    }
  }

  async requestBatch<T>(
    queries: JsonQuery[],
    { transaction, traceparent }: RequestBatchOptions<undefined>,
  ): Promise<BatchQueryEngineResult<T>[]> {
    debug('requestBatch')
    const request = getBatchRequestPayload(queries, transaction)
    await this.start()

    this.lastQuery = JSON.stringify(request)

    this.executingQueryPromise = this.engine!.query(
      this.lastQuery,
      JSON.stringify({ traceparent }),
      getInteractiveTransactionId(transaction),
    )

    const result = await this.executingQueryPromise
    const data = this.parseEngineResponse<any>(result)

    if (data.errors) {
      if (data.errors.length === 1) {
        throw this.buildQueryError(data.errors[0])
      }
      // this case should not happen, as the query engine only returns one error
      throw new PrismaClientUnknownRequestError(JSON.stringify(data.errors), {
        clientVersion: this.config.clientVersion!,
      })
    }

    const { batchResult, errors } = data
    if (Array.isArray(batchResult)) {
      return batchResult.map((result) => {
        if (result.errors && result.errors.length > 0) {
          return this.loggerRustPanic ?? this.buildQueryError(result.errors[0])
        }
        return {
          data: result,
          elapsed: 0, // TODO Implement Elapsed: https://github.com/prisma/prisma/issues/7726
        }
      })
    } else {
      if (errors && errors.length === 1) {
        throw new Error(errors[0].error)
      }
      throw new Error(JSON.stringify(data))
    }
  }

  private buildQueryError(error: RequestError) {
    if (error.user_facing_error.is_panic && TARGET_BUILD_TYPE !== 'wasm') {
      return new PrismaClientRustPanicError(
        getErrorMessageWithLink(this, error.user_facing_error.message),
        this.config.clientVersion!,
      )
    }

    const externalError = this.getExternalAdapterError(error.user_facing_error)

    return externalError
      ? externalError.error
      : prismaGraphQLToJSError(error, this.config.clientVersion!, this.config.activeProvider!)
  }

  private getExternalAdapterError(error: RequestError['user_facing_error']): ErrorRecord | undefined {
    if (error.error_code === DRIVER_ADAPTER_EXTERNAL_ERROR && this.config.adapter) {
      const id = error.meta?.id
      assertAlways(typeof id === 'number', 'Malformed external JS error received from the engine')
      const errorRecord = this.config.adapter.errorRegistry.consumeError(id)
      assertAlways(errorRecord, `External error with reported id was not registered`)
      return errorRecord
    }
    return undefined
  }

  async metrics(options: MetricsOptionsJson): Promise<Metrics>
  async metrics(options: MetricsOptionsPrometheus): Promise<string>
  async metrics(options: EngineMetricsOptions): Promise<Metrics | string> {
    await this.start()
    const responseString = await this.engine!.metrics(JSON.stringify(options))
    if (options.format === 'prometheus') {
      return responseString
    }
    return this.parseEngineResponse(responseString)
  }
}

function isUserFacingError(e: unknown): e is RequestError['user_facing_error'] {
  return typeof e === 'object' && e !== null && e['error_code'] !== undefined
}

function getErrorMessageWithLink(engine: LibraryEngine, title: string) {
  return genericGetErrorMessageWithLink({
    binaryTarget: engine.binaryTarget,
    title,
    version: engine.config.clientVersion!,
    engineVersion: engine.versionInfo?.commit,
    database: engine.config.activeProvider as any,
    query: engine.lastQuery!,
  })
}
