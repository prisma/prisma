import { EngineType } from '@prisma/fetch-engine'
import type { EngineName } from '@prisma/generator-helper'

export function engineTypeToEngineName(engineType: string): EngineName {
  if (engineType === EngineType.libqueryEngine) {
    return 'libqueryEngine'
  }
  if (engineType === EngineType.queryEngine) {
    return 'queryEngine'
  }
  if (engineType === EngineType.migrationEngine) {
    return 'migrationEngine'
  }
  if (engineType === EngineType.introspectionEngine) {
    return 'introspectionEngine'
  }
  if (engineType === EngineType.prismaFmt) {
    return 'prismaFmt'
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
