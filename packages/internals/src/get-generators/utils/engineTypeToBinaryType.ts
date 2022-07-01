import { EngineNameEnum } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function engineTypeToBinaryType(engineType: EngineNameEnum): EngineNameEnum {
  if (engineType === 'introspectionEngine') {
    return EngineNameEnum.introspectionEngine
  }

  if (engineType === 'migrationEngine') {
    return EngineNameEnum.migrationEngine
  }

  if (engineType === 'queryEngine') {
    return EngineNameEnum.queryEngine
  }
  if (engineType === 'libqueryEngine') {
    return EngineNameEnum.libqueryEngine
  }
  if (engineType === 'prismaFmt') {
    return EngineNameEnum.prismaFmt
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
