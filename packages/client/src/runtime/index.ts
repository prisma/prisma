import * as lzString from 'lz-string'

export {
  type Metric,
  type MetricHistogram,
  type MetricHistogramBucket,
  type Metrics,
  MetricsClient,
} from './core/metrics/MetricsClient'
export { DMMFHelper as DMMFClass } from './dmmf'
export { type BaseDMMF, DMMF } from './dmmf-types'
export type { PrismaClientOptions } from './getPrismaClient'
export { getPrismaClient } from './getPrismaClient'
export { objectEnumValues } from './object-enums'
export { makeDocument, PrismaClientValidationError, transformDocument, unpack } from './query'
export type { DecimalJsLike } from './utils/decimalJsLike'
export { findSync } from './utils/find'
export { NotFoundError } from './utils/rejectOnNotFound'
export { warnEnvConflicts } from './warnEnvConflicts'
export {
  Engine,
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@prisma/engine-core'
export { default as Decimal } from 'decimal.js'
export type { RawValue, Value } from 'sql-template-tag'
export { empty, join, raw, Sql, sqltag } from 'sql-template-tag'
// ! export bundling fails for this dep, we work around it
const decompressFromBase64 = lzString.decompressFromBase64
export { decompressFromBase64 }
