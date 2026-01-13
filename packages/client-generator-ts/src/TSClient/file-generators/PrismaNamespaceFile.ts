import * as ts from '@prisma/ts-builders'

import { commonCodeTS } from '../common'
import { Enum } from '../Enum'
import { FieldRefInput } from '../FieldRefInput'
import { GenerateContext } from '../GenerateContext'
import { globalOmitConfig } from '../globalOmit'
import type { TSClientOptions } from '../TSClient'
import { clientTypeMapDefinition } from '../TypeMap'

const jsDocHeader = `/*
 * WARNING: This is an internal file that is subject to change!
 *
 * 🛑 Under no circumstances should you import this file directly! 🛑
 *
 * All exports from this file are wrapped under a \`Prisma\` namespace object in the client.ts file.
 * While this enables partial backward compatibility, it is not part of the stable public API.
 *
 * If you are looking for your Models, Enums, and Input Types, please import them from the respective
 * model files in the \`model\` directory!
 */
`
export function createPrismaNamespaceFile(context: GenerateContext, options: TSClientOptions): string {
  const imports = [
    ts.moduleImport(context.runtimeImport).asNamespace('runtime'),
    ts.moduleImport(context.importFileName(`../models`)).asNamespace('Prisma').typeOnly(),
    ts.moduleImport(context.importFileName(`./class`)).named(ts.namedImport('PrismaClient').typeOnly()),
  ].map((i) => ts.stringify(i))

  const prismaEnums = context.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toTS())

  const fieldRefs = context.dmmf.schema.fieldRefTypes.prisma?.map((type) => new FieldRefInput(type).toTS()) ?? []

  return `${jsDocHeader}
${imports.join('\n')}

export type * from '${context.importFileName(`../models`)}'

${commonCodeTS(options)}
${new Enum(
  {
    name: 'ModelName',
    values: context.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toTS()}

${clientTypeMapDefinition(context)}

/**
 * Enums
 */

${prismaEnums?.join('\n\n')}

${
  fieldRefs.length > 0
    ? `
/**
 * Field references
 */

${fieldRefs.join('\n\n')}`
    : ''
}

/**
 * Batch Payload for updateMany & deleteMany & createMany
 */
export type BatchPayload = {
  count: number
}

${clientExtensionsDefinitions()}
export type DefaultPrismaClient = PrismaClient
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
${ts.stringify(ts.moduleExport(buildClientOptions(context)))}
${ts.stringify(globalOmitConfig(context.dmmf))}

/* Types for Logging */
export type LogLevel = 'info' | 'query' | 'warn' | 'error'
export type LogDefinition = {
  level: LogLevel
  emit: 'stdout' | 'event'
}

export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

export type GetLogType<T> = CheckIsLogLevel<
  T extends LogDefinition ? T['level'] : T
>;

export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
  ? GetLogType<T[number]>
  : never;

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
  | 'createManyAndReturn'
  | 'update'
  | 'updateMany'
  | 'updateManyAndReturn'
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
 * \`PrismaClient\` proxy available in interactive transactions.
 */
export type TransactionClient = Omit<DefaultPrismaClient, runtime.ITXClientDenyList>

`
}

function clientExtensionsDefinitions() {
  const define = ts.moduleExport(
    ts.constDeclaration('defineExtension').setValue(
      ts
        .namedValue('runtime.Extensions.defineExtension')
        .as(ts.namedType('unknown'))
        .as(
          ts
            .namedType('runtime.Types.Extensions.ExtendsHook')
            .addGenericArgument(ts.stringLiteral('define'))
            .addGenericArgument(ts.namedType('TypeMapCb'))
            .addGenericArgument(ts.namedType('runtime.Types.Extensions.DefaultArgs')),
        ),
    ),
  )

  return ts.stringify(define)
}

function buildClientOptions(context: GenerateContext) {
  // Build the mutually exclusive options union type
  // This matches PrismaClientMutuallyExclusiveOptions from runtime
  const adapterOption = ts
    .objectType()
    .add(
      ts
        .property('adapter', ts.namedType('runtime.SqlDriverAdapterFactory'))
        .setDocComment(ts.docComment('Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-pg`.')),
    )
    .add(ts.property('accelerateUrl', ts.neverType).optional())

  const accelerateUrlOption = ts
    .objectType()
    .add(
      ts
        .property('accelerateUrl', ts.stringType)
        .setDocComment(
          ts.docComment(
            'Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.',
          ),
        ),
    )
    .add(ts.property('adapter', ts.neverType).optional())

  const mutuallyExclusiveOptions = ts.unionType([adapterOption, accelerateUrlOption])

  // Build the other optional properties
  const otherOptions = ts
    .objectType()
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
             // Shorthand for \`emit: 'stdout'\`
             log: ['query', 'info', 'warn', 'error']

             // Emit as events only
             log: [
               { emit: 'event', level: 'query' },
               { emit: 'event', level: 'info' },
               { emit: 'event', level: 'warn' }
               { emit: 'event', level: 'error' }
             ]

            // Emit as events and log to stdout
            log: [
              { emit: 'stdout', level: 'query' },
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' }
              { emit: 'stdout', level: 'error' }
            ]
             \`\`\`
             Read more in our [docs](https://pris.ly/d/logging).
          `),
    )

  const transactionOptions = ts
    .objectType()
    .add(ts.property('maxWait', ts.numberType).optional())
    .add(ts.property('timeout', ts.numberType).optional())

  if (context.dmmf.hasEnumInNamespace('TransactionIsolationLevel', 'prisma')) {
    transactionOptions.add(ts.property('isolationLevel', ts.namedType('TransactionIsolationLevel')).optional())
  }

  otherOptions.add(
    ts.property('transactionOptions', transactionOptions).optional().setDocComment(ts.docComment`
             The default values for transactionOptions
             maxWait ?= 2000
             timeout ?= 5000
          `),
  )

  otherOptions.add(
    ts.property('omit', ts.namedType('GlobalOmitConfig')).optional().setDocComment(ts.docComment`
        Global configuration for omitting model fields by default.

        @example
        \`\`\`
        const prisma = new PrismaClient({
          omit: {
            user: {
              password: true
            }
          }
        })
        \`\`\`
      `),
  )

  if (context.isSqlProvider()) {
    otherOptions.add(
      ts.property('comments', ts.array(ts.namedType('runtime.SqlCommenterPlugin'))).optional()
        .setDocComment(ts.docComment`
        SQL commenter plugins that add metadata to SQL queries as comments.
        Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/

        @example
        \`\`\`
        const prisma = new PrismaClient({
          adapter,
          comments: [
            traceContext(),
            queryInsights(),
          ],
        })
        \`\`\`
      `),
    )
  }

  // Intersect the mutually exclusive options with the other options
  // This matches: PrismaClientOptions = PrismaClientMutuallyExclusiveOptions & { ... }
  const prismaClientOptions = ts.intersectionType([mutuallyExclusiveOptions, otherOptions])

  return ts.typeDeclaration('PrismaClientOptions', prismaClientOptions)
}
