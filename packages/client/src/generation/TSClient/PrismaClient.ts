import type { DataSource, GeneratorConfig } from '@prisma/generator-helper'
import { assertNever } from '@prisma/internals'
import indent from 'indent-string'

import { Operation } from '../../runtime/core/types/exported/Result'
import { DMMFHelper } from '../dmmf'
import * as ts from '../ts-builders'
import {
  capitalize,
  getAggregateName,
  getCountAggregateOutputName,
  getFieldRefsTypeName,
  getGroupByName,
  getModelArgName,
  getPayloadName,
} from '../utils'
import { lowerCase } from '../utils/common'
import { runtimeImport } from '../utils/runtimeImport'
import { TAB_SIZE } from './constants'
import { Datasources } from './Datasources'
import type { Generatable } from './Generatable'
import { TSClientOptions } from './TSClient'
import { getModelActions } from './utils/getModelActions'

function clientTypeMapModelsDefinition(this: PrismaClientClass) {
  const modelNames = this.dmmf.datamodel.models.map((m) => m.name)

  return `{
  meta: {
    modelProps: ${modelNames.map((mn) => `'${lowerCase(mn)}'`).join(' | ')}
    txIsolationLevel: ${
      this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma') ? 'Prisma.TransactionIsolationLevel' : 'never'
    }
  },
  model: {${modelNames.reduce((acc, modelName) => {
    const actions = getModelActions(this.dmmf, modelName)

    return `${acc}
    ${modelName}: {
      payload: ${getPayloadName(modelName)}<ExtArgs>
      fields: Prisma.${getFieldRefsTypeName(modelName)}
      operations: {${actions.reduce((acc, action) => {
        return `${acc}
        ${action}: {
          args: Prisma.${getModelArgName(modelName, action)}<ExtArgs>,
          result: ${clientTypeMapModelsResultDefinition(modelName, action)}
        }`
      }, '')}
      }
    }`
  }, '')}
  }
}`
}

function clientTypeMapModelsResultDefinition(modelName: string, action: Exclude<Operation, `$${string}`>) {
  if (action === 'count') return `$Utils.Optional<${getCountAggregateOutputName(modelName)}> | number`
  if (action === 'groupBy') return `$Utils.Optional<${getGroupByName(modelName)}>[]`
  if (action === 'aggregate') return `$Utils.Optional<${getAggregateName(modelName)}>`
  if (action === 'findRaw') return `Prisma.JsonObject`
  if (action === 'aggregateRaw') return `Prisma.JsonObject`
  if (action === 'deleteMany') return `Prisma.BatchPayload`
  if (action === 'createMany') return `Prisma.BatchPayload`
  if (action === 'updateMany') return `Prisma.BatchPayload`
  if (action === 'findMany') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>[]`
  if (action === 'findFirst') return `$Utils.PayloadToResult<${getPayloadName(modelName)}> | null`
  if (action === 'findUnique') return `$Utils.PayloadToResult<${getPayloadName(modelName)}> | null`
  if (action === 'findFirstOrThrow') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`
  if (action === 'findUniqueOrThrow') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`
  if (action === 'create') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`
  if (action === 'update') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`
  if (action === 'upsert') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`
  if (action === 'delete') return `$Utils.PayloadToResult<${getPayloadName(modelName)}>`

  assertNever(action, 'Unknown action: ' + action)
}

function clientTypeMapOthersDefinition(this: PrismaClientClass) {
  const otherOperationsNames = this.dmmf.getOtherOperationNames().flatMap((n) => {
    if (n === 'executeRaw' || n === 'queryRaw') {
      return [`$${n}Unsafe`, `$${n}`]
    }

    return `$${n}`
  })

  const argsResultMap = {
    $executeRaw: { args: '[query: TemplateStringsArray | Prisma.Sql, ...values: any[]]', result: 'any' },
    $queryRaw: { args: '[query: TemplateStringsArray | Prisma.Sql, ...values: any[]]', result: 'any' },
    $executeRawUnsafe: { args: '[query: string, ...values: any[]]', result: 'any' },
    $queryRawUnsafe: { args: '[query: string, ...values: any[]]', result: 'any' },
    $runCommandRaw: { args: 'Prisma.InputJsonObject', result: 'Prisma.JsonObject' },
  }

  return `{
  other: {
    payload: any
    operations: {${otherOperationsNames.reduce((acc, action) => {
      return `${acc}
      ${action}: {
        args: ${argsResultMap[action].args},
        result: ${argsResultMap[action].result}
      }`
    }, '')}
    }
  }
}`
}

function clientTypeMapDefinition(this: PrismaClientClass) {
  const typeMap = `${clientTypeMapModelsDefinition.bind(this)()} & ${clientTypeMapOthersDefinition.bind(this)()}`

  return `
interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs}, $Utils.Record<string, any>> {
  returns: Prisma.TypeMap<this['params']['extArgs']>
}

export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ${typeMap}`
}

function clientExtensionsDefinitions(this: PrismaClientClass) {
  const typeMap = clientTypeMapDefinition.call(this)
  const define = `export const defineExtension: $Extensions.ExtendsHook<'define', Prisma.TypeMapCb, $Extensions.DefaultArgs>`
  const extend = `  $extends: $Extensions.ExtendsHook<'extends', Prisma.TypeMapCb, ExtArgs>`

  return {
    prismaNamespaceDefinitions: `
${typeMap}
${define}`,
    prismaClientDefinitions: `${extend}`,
  }
}

function batchingTransactionDefinition(this: PrismaClientClass) {
  const method = ts
    .method('$transaction')
    .setDocComment(
      ts.docComment`
        Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
        @example
        \`\`\`
        const [george, bob, alice] = await prisma.$transaction([
          prisma.user.create({ data: { name: 'George' } }),
          prisma.user.create({ data: { name: 'Bob' } }),
          prisma.user.create({ data: { name: 'Alice' } }),
        ])
        \`\`\`

        Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
      `,
    )
    .addGenericParameter(ts.genericParameter('P').extends(ts.array(ts.prismaPromise(ts.anyType))))
    .addParameter(ts.parameter('arg', ts.arraySpread(ts.namedType('P'))))
    .setReturnType(ts.promise(ts.namedType('runtime.Types.Utils.UnwrapTuple').addGenericArgument(ts.namedType('P'))))

  if (this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
    const options = ts
      .objectType()
      .formatInline()
      .add(ts.property('isolationLevel', ts.namedType('Prisma.TransactionIsolationLevel')).optional())
    method.addParameter(ts.parameter('options', options).optional())
  }

  return ts.stringify(method, { indentLevel: 1, newLine: 'leading' })
}

function interactiveTransactionDefinition(this: PrismaClientClass) {
  const options = ts
    .objectType()
    .formatInline()
    .add(ts.property('maxWait', ts.numberType).optional())
    .add(ts.property('timeout', ts.numberType).optional())

  if (this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
    const isolationLevel = ts.property('isolationLevel', ts.namedType('Prisma.TransactionIsolationLevel')).optional()
    options.add(isolationLevel)
  }

  const returnType = ts.promise(ts.namedType('R'))

  const callbackType = ts
    .functionType()
    .addParameter(
      ts.parameter('prisma', ts.omit(ts.namedType('PrismaClient'), ts.namedType('runtime.ITXClientDenyList'))),
    )
    .setReturnType(returnType)

  const method = ts
    .method('$transaction')
    .addGenericParameter(ts.genericParameter('R'))
    .addParameter(ts.parameter('fn', callbackType))
    .addParameter(ts.parameter('options', options).optional())
    .setReturnType(returnType)

  return ts.stringify(method, { indentLevel: 1, newLine: 'leading' })
}

function queryRawDefinition(this: PrismaClientClass) {
  // we do not generate `$queryRaw...` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('queryRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  return `
  /**
   * Performs a prepared raw query and returns the \`SELECT\` data.
   * @example
   * \`\`\`
   * const result = await prisma.$queryRaw\`SELECT * FROM User WHERE id = \${1} OR email = \${'user@email.com'};\`
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the \`SELECT\` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * \`\`\`
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;`
}

function executeRawDefinition(this: PrismaClientClass) {
  // we do not generate `$executeRaw...` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('executeRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  return `
  /**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * \`\`\`
   * const result = await prisma.$executeRaw\`UPDATE User SET cool = \${true} WHERE email = \${'user@email.com'};\`
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * \`\`\`
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * \`\`\`
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;`
}

function metricDefinition(this: PrismaClientClass) {
  if (!this.generator?.previewFeatures.includes('metrics')) {
    return ''
  }

  const property = ts
    .property('$metrics', ts.namedType(`runtime.${runtimeImport('MetricsClient')}`))
    .setDocComment(
      ts.docComment`
        Gives access to the client metrics in json or prometheus format.
        
        @example
        \`\`\`
        const metrics = await prisma.$metrics.json()
        // or
        const metrics = await prisma.$metrics.prometheus()
        \`\`\`
    `,
    )
    .readonly()

  return ts.stringify(property, { indentLevel: 1, newLine: 'leading' })
}

function runCommandRawDefinition(this: PrismaClientClass) {
  // we do not generate `$runCommandRaw` definitions if not supported
  if (!this.dmmf.mappings.otherOperations.write.includes('runCommandRaw')) {
    return '' // https://github.com/prisma/prisma/issues/8189
  }

  const method = ts
    .method('$runCommandRaw')
    .addParameter(ts.parameter('command', ts.namedType('Prisma.InputJsonObject')))
    .setReturnType(ts.prismaPromise(ts.namedType('Prisma.JsonObject'))).setDocComment(ts.docComment`
      Executes a raw MongoDB command and returns the result of it.
      @example
      \`\`\`
      const user = await prisma.$runCommandRaw({
        aggregate: 'User',
        pipeline: [{ $match: { name: 'Bob' } }, { $project: { email: true, _id: false } }],
        explain: false,
      })
      \`\`\`
   
      Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
    `)

  return ts.stringify(method, { indentLevel: 1, newLine: 'leading' })
}

function applyPendingMigrationsDefinition(this: PrismaClientClass) {
  if (this.runtimeNameTs !== 'react-native') {
    return null
  }

  const method = ts
    .method('$applyPendingMigrations')
    .setReturnType(ts.promise(ts.voidType))
    .setDocComment(
      ts.docComment`Tries to apply pending migrations one by one. If a migration fails to apply, the function will stop and throw an error. You are responsible for informing the user and possibly blocking the app as we cannot guarantee the state of the database.`,
    )

  return ts.stringify(method, { indentLevel: 1, newLine: 'leading' })
}

function eventRegistrationMethodDeclaration(runtimeNameTs: TSClientOptions['runtimeNameTs']) {
  if (runtimeNameTs === 'binary.js') {
    return `$on<V extends (U | 'beforeExit')>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : V extends 'beforeExit' ? () => $Utils.JsPromise<void> : Prisma.LogEvent) => void): void;`
  } else {
    return `$on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;`
  }
}

export class PrismaClientClass implements Generatable {
  protected clientExtensionsDefinitions: {
    prismaNamespaceDefinitions: string
    prismaClientDefinitions: string
  }
  constructor(
    protected readonly dmmf: DMMFHelper,
    protected readonly internalDatasources: DataSource[],
    protected readonly outputDir: string,
    protected readonly runtimeNameTs: TSClientOptions['runtimeNameTs'],
    protected readonly browser?: boolean,
    protected readonly generator?: GeneratorConfig,
    protected readonly cwd?: string,
  ) {
    this.clientExtensionsDefinitions = clientExtensionsDefinitions.bind(this)()
  }
  private get jsDoc(): string {
    const { dmmf } = this

    const example = dmmf.mappings.modelOperations[0]
    return `/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * \`\`\`
 * const prisma = new PrismaClient()
 * // Fetch zero or more ${capitalize(example.plural)}
 * const ${lowerCase(example.plural)} = await prisma.${lowerCase(example.model)}.findMany()
 * \`\`\`
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */`
  }
  public toTSWithoutNamespace(): string {
    const { dmmf } = this
    return `${this.jsDoc}
export class PrismaClient<
  T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof T ? T['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<T['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

  ${indent(this.jsDoc, TAB_SIZE)}

  constructor(optionsArg ?: Prisma.Subset<T, Prisma.PrismaClientOptions>);
  ${eventRegistrationMethodDeclaration(this.runtimeNameTs)}

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

${[
  executeRawDefinition.bind(this)(),
  queryRawDefinition.bind(this)(),
  batchingTransactionDefinition.bind(this)(),
  interactiveTransactionDefinition.bind(this)(),
  runCommandRawDefinition.bind(this)(),
  metricDefinition.bind(this)(),
  applyPendingMigrationsDefinition.bind(this)(),
  this.clientExtensionsDefinitions.prismaClientDefinitions,
]
  .filter((d) => d !== null)
  .join('\n')
  .trim()}

    ${indent(
      dmmf.mappings.modelOperations
        .filter((m) => m.findMany)
        .map((m) => {
          let methodName = lowerCase(m.model)
          if (methodName === 'constructor') {
            methodName = '["constructor"]'
          }
          return `\
/**
 * \`prisma.${methodName}\`: Exposes CRUD operations for the **${m.model}** model.
  * Example usage:
  * \`\`\`ts
  * // Fetch zero or more ${capitalize(m.plural)}
  * const ${lowerCase(m.plural)} = await prisma.${methodName}.findMany()
  * \`\`\`
  */
get ${methodName}(): Prisma.${m.model}Delegate<ExtArgs>;`
        })
        .join('\n\n'),
      2,
    )}
}`
  }
  public toTS(): string {
    const clientOptions = this.buildClientOptions()

    return `${new Datasources(this.internalDatasources).toTS()}
${this.clientExtensionsDefinitions.prismaNamespaceDefinitions}
export type DefaultPrismaClient = PrismaClient
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
${ts.stringify(ts.moduleExport(clientOptions))}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
  GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
  : never

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


export type PrismaAction =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findMany'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'upsert'
  | 'delete'
  | 'deleteMany'
  | 'executeRaw'
  | 'queryRaw'
  | 'aggregate'
  | 'count'
  | 'runCommandRaw'
  | 'findRaw'
  | 'groupBy'

/**
 * These options are being passed into the middleware as "params"
 */
export type MiddlewareParams = {
  model?: ModelName
  action: PrismaAction
  args: any
  dataPath: string[]
  runInTransaction: boolean
}

/**
 * The \`T\` type makes sure, that the \`return proceed\` is not forgotten in the middleware implementation
 */
export type Middleware<T = any> = (
  params: MiddlewareParams,
  next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
) => $Utils.JsPromise<T>

// tested in getLogLevel.test.ts
export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

/**
 * \`PrismaClient\` proxy available in interactive transactions.
 */
export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>
`
  }

  private buildClientOptions() {
    const clientOptions = ts
      .interfaceDeclaration('PrismaClientOptions')
      .add(
        ts
          .property('datasources', ts.namedType('Datasources'))
          .optional()
          .setDocComment(ts.docComment('Overwrites the datasource url from your schema.prisma file')),
      )
      .add(
        ts
          .property('datasourceUrl', ts.stringType)
          .optional()
          .setDocComment(ts.docComment('Overwrites the datasource url from your schema.prisma file')),
      )
      .add(
        ts
          .property('errorFormat', ts.namedType('ErrorFormat'))
          .optional()
          .setDocComment(ts.docComment('@default "colorless"')),
      )
      .add(
        ts.property('log', ts.array(ts.unionType([ts.namedType('LogLevel'), ts.namedType('LogDefinition')]))).optional()
          .setDocComment(ts.docComment`
             @example
             \`\`\`
             // Defaults to stdout
             log: ['query', 'info', 'warn', 'error']
            
             // Emit as events
             log: [
               { emit: 'stdout', level: 'query' },
               { emit: 'stdout', level: 'info' },
               { emit: 'stdout', level: 'warn' }
               { emit: 'stdout', level: 'error' }
             ]
             \`\`\`
             Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
          `),
      )

    const transactionOptions = ts
      .objectType()
      .add(ts.property('maxWait', ts.numberType).optional())
      .add(ts.property('timeout', ts.numberType).optional())

    if (this.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
      transactionOptions.add(ts.property('isolationLevel', ts.namedType('Prisma.TransactionIsolationLevel')).optional())
    }

    clientOptions.add(
      ts.property('transactionOptions', transactionOptions).optional().setDocComment(ts.docComment`
             The default values for transactionOptions
             maxWait ?= 2000
             timeout ?= 5000
          `),
    )

    if (this.runtimeNameTs === 'library.js' && this.generator?.previewFeatures.includes('driverAdapters')) {
      clientOptions.add(
        ts
          .property('adapter', ts.unionType([ts.namedType('runtime.DriverAdapter'), ts.namedType('null')]))
          .optional()
          .setDocComment(
            ts.docComment('Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`'),
          ),
      )
    }
    return clientOptions
  }
}
