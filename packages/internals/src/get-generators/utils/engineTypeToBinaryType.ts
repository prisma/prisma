import { EngineTypeEnum } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function engineTypeToBinaryType(engineType: EngineType): EngineTypeEnum {
  if (engineType === 'introspectionEngine') {
    return EngineTypeEnum.introspectionEngine
  }

  if (engineType === 'migrationEngine') {
    return EngineTypeEnum.migrationEngine
  }

  if (engineType === 'queryEngine') {
    return EngineTypeEnum.queryEngine
  }
  if (engineType === 'libqueryEngine') {
    return EngineTypeEnum.libqueryEngine
  }
  if (engineType === 'prismaFmt') {
    return EngineTypeEnum.prismaFmt
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
