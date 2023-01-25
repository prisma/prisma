import { BinaryType } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function binaryTypeToEngineType(binaryType: string): EngineType {
  if (binaryType === BinaryType.migrationEngine) {
    return 'migrationEngine'
  }
  if (binaryType === BinaryType.libqueryEngine) {
    return 'libqueryEngine'
  }
  if (binaryType === BinaryType.queryEngine) {
    return 'queryEngine'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}
