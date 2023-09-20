import * as Extensions from './core/extensions'
import * as Public from './core/public'
import * as Types from './core/types'

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
export type { DriverAdapter } from '@prisma/driver-adapter-utils'
export { default as Decimal } from 'decimal.js'
export type { RawValue, Value } from 'sql-template-tag'
export { empty, join, raw, Sql, default as sqltag } from 'sql-template-tag'

export { Types }
export { Extensions }
export { Public }

export type { ITXClientDenyList } from './itxClientDenyList'
export { warnOnce } from '@prisma/internals'

/**
 * Workaround for some of the Accelerate versions.
 * It happens so that our type bundler renames types if the have conflicting names. Types
 * with the same name that come later get _N suffix.
 * We then make all bundled types public for performance reason. That also includes renamed types.
 * In turn, that allows tsc to inline any type into dependent project's definition. And that also includes
 * renamed types.
 * What happened is, accelerate got published with `Result_2` type in it's declaration file.
 * See https://unpkg.com/@prisma/extension-accelerate@0.6.2/dist/esm/entry.node.d.ts
 *
 * In the future prisma version, order of the modules changed and `Result_2` alias no longer referred to the same type.
 * Adding this alias manually ensures older accelerate versions continue to work.
 */
export type Result_2<T, A, F extends Types.Result.Operation> = Types.Public.Result<T, A, F>
