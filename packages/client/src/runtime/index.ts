import * as Extensions from './core/extensions'
import * as Types from './core/types'
import { Payload } from './core/types'

export { PrismaClientInitializationError } from './core/errors/PrismaClientInitializationError'
export { PrismaClientKnownRequestError } from './core/errors/PrismaClientKnownRequestError'
export { PrismaClientRustPanicError } from './core/errors/PrismaClientRustPanicError'
export { PrismaClientUnknownRequestError } from './core/errors/PrismaClientUnknownRequestError'
export {
  type Metric,
  type MetricHistogram,
  type MetricHistogramBucket,
  type Metrics,
  MetricsClient,
} from './core/metrics/MetricsClient'
export type { FieldRef } from './core/model/FieldRef'
export { defineDmmfProperty } from './core/runtimeDataModel'
export { DMMFHelper as DMMFClass } from './dmmf'
export { type BaseDMMF, DMMF } from './dmmf-types'
export type { PrismaClientOptions } from './getPrismaClient'
export { getPrismaClient } from './getPrismaClient'
export { objectEnumValues } from './object-enums'
export { makeDocument, PrismaClientValidationError, transformDocument, unpack } from './query'
export { makeStrictEnum } from './strictEnum'
export type { DecimalJsLike } from './utils/decimalJsLike'
export { decompressFromBase64 } from './utils/decompressFromBase64'
export { NotFoundError } from './utils/rejectOnNotFound'
export { warnEnvConflicts } from './warnEnvConflicts'
export { Debug } from '@prisma/debug'
export { default as Decimal } from 'decimal.js'
export type { RawValue, Value } from 'sql-template-tag'
export { empty, join, raw, Sql, default as sqltag } from 'sql-template-tag'

export { Types }
export { Extensions }
export { warnOnce } from '@prisma/internals'

/**
 * Payload is already exported via Types but tsc will complain that it isn't reachable
 * The issue lies with the type bundler which does not add exports for dependent types
 * TODO: Maybe simply exporting all types in runtime will do the trick
 */
export { type Payload }

export type { ITXClientDenyList } from './itxClientDenyList'
