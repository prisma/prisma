import { runInChildSpan } from '@prisma/engine-core'
import * as lzString from 'lz-string'

import * as Extensions from './core/extensions'
import * as Types from './core/types'
import { Payload } from './core/types'

export {
  type Metric,
  type MetricHistogram,
  type MetricHistogramBucket,
  type Metrics,
  MetricsClient,
} from './core/metrics/MetricsClient'
export type { FieldRef } from './core/model/FieldRef'
export { DMMFHelper as DMMFClass } from './dmmf'
export { type BaseDMMF, DMMF } from './dmmf-types'
export type { PrismaClientOptions } from './getPrismaClient'
export { getPrismaClient } from './getPrismaClient'
export { objectEnumValues } from './object-enums'
export { makeDocument, PrismaClientValidationError, transformDocument, unpack } from './query'
export { makeStrictEnum } from './strictEnum'
export type { DecimalJsLike } from './utils/decimalJsLike'
export { findSync } from './utils/find'
export { NotFoundError } from './utils/rejectOnNotFound'
export { warnEnvConflicts } from './warnEnvConflicts'
export { Debug } from '@prisma/debug'
export {
  Engine,
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
} from '@prisma/engine-core'
export { default as Decimal } from 'decimal.js'
export type { RawValue, Value } from 'sql-template-tag'
export { empty, join, raw, Sql, default as sqltag } from 'sql-template-tag'

// ! export bundling fails for this dep, we work around it
export function decompressFromBase64(str: string): string {
  return runInChildSpan({ name: 'decompressDmmf', enabled: true, internal: true }, () => {
    return lzString.decompressFromBase64(str)
  })
}

export function parseDmmf(str): any {
  return runInChildSpan({ name: 'parseDmmf', enabled: true, internal: true }, () => JSON.parse(str))
}

export { Types }
export { Extensions }

/**
 * Payload is already exported via Types but tsc will complain that it isn't reachable
 * The issue lies with the type bundler which does not add exports for dependent types
 * TODO: Maybe simply exporting all types in runtime will do the trick
 */
export { type Payload }
