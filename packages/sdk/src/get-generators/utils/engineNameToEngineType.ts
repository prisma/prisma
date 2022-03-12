import { EngineType } from '@prisma/fetch-engine'
import type { EngineName } from '@prisma/generator-helper'

export function engineNameToEngineType(engineName: EngineName): EngineType {
  if (engineName === 'introspectionEngine') {
    return EngineType.introspectionEngine
  }
  if (engineName === 'migrationEngine') {
    return EngineType.migrationEngine
  }
  if (engineName === 'queryEngine') {
    return EngineType.queryEngine
  }
  if (engineName === 'libqueryEngine') {
    return EngineType.libqueryEngine
  }
  if (engineName === 'prismaFmt') {
    return EngineType.prismaFmt
  }

  throw new Error(`Could not convert engine name ${engineName}`)
}
