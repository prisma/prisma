import { EngineTypeEnum } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function binaryTypeToEngineType(binaryType: string): EngineType {
  if (binaryType === EngineTypeEnum.introspectionEngine) {
    return 'introspectionEngine'
  }

  if (binaryType === EngineTypeEnum.migrationEngine) {
    return 'migrationEngine'
  }
  if (binaryType === EngineTypeEnum.libqueryEngine) {
    return 'libqueryEngine'
  }
  if (binaryType === EngineTypeEnum.queryEngine) {
    return 'queryEngine'
  }

  if (binaryType === EngineTypeEnum.prismaFmt) {
    return 'prismaFmt'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}
