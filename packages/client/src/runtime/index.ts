import * as Extensions from './core/extensions'
import * as Public from './core/public'
import * as Types from './core/types'
import { Payload } from './core/types'
import type { PrismaPromise } from './core/types/Public'

export { DMMFHelper as DMMFClass } from '../generation/dmmf'
export { type BaseDMMF, DMMF } from '../generation/dmmf-types'
export { NotFoundError } from './core/errors/NotFoundError'
export { PrismaClientInitializationError } from './core/errors/PrismaClientInitializationError'
export { PrismaClientKnownRequestError } from './core/errors/PrismaClientKnownRequestError'
export { PrismaClientRustPanicError } from './core/errors/PrismaClientRustPanicError'
export { PrismaClientUnknownRequestError } from './core/errors/PrismaClientUnknownRequestError'
export { PrismaClientValidationError } from './core/errors/PrismaClientValidationError'
export {
  type Metric,
  type MetricHistogram,
  type MetricHistogramBucket,
  type Metrics,
  MetricsClient,
} from './core/metrics/MetricsClient'
export type { FieldRef } from './core/model/FieldRef'
export { defineDmmfProperty } from './core/runtimeDataModel'
export type { PrismaClientOptions } from './getPrismaClient'
export { getPrismaClient } from './getPrismaClient'
export { objectEnumValues } from './object-enums'
export { makeStrictEnum } from './strictEnum'
export type { DecimalJsLike } from './utils/decimalJsLike'
export { warnEnvConflicts } from './warnEnvConflicts'
export { Debug } from '@prisma/debug'
export { default as Decimal } from 'decimal.js'
export type { RawValue, Value } from 'sql-template-tag'
export { empty, join, raw, Sql, default as sqltag } from 'sql-template-tag'

export { Types }
export { Extensions }
export { Public }
export { warnOnce } from '@prisma/internals'

/**
 * Payload, PrismaPromise and Extensions types are already exported via Types but tsc
 * won't be able to trace them correctly back to runtime module and fail with either
 * "... is using the type X but can not be named" or "The inferred type of this node exceeds the maximum length" error.
 * The issue lies with the type bundler which does not add exports for dependent types
 * TODO: Maybe simply exporting all types in runtime will do the trick
 */
export { type Payload, type PrismaPromise }

export * from './core/types/Extensions'
export type { ITXClientDenyList } from './itxClientDenyList'
