import { BinaryType } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function engineTypeToBinaryType(engineType: EngineType): BinaryType {
  if (engineType === 'migrationEngine') {
    return BinaryType.MigrationEngineBinary
  }

  if (engineType === 'queryEngine') {
    return BinaryType.QueryEngineBinary
  }
  if (engineType === 'libqueryEngine') {
    return BinaryType.QueryEngineLibrary
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
