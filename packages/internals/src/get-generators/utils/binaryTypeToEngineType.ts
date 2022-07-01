import { EngineNameEnum } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function binaryTypeToEngineType(binaryType: string): EngineType {
  if (binaryType === EngineNameEnum.introspectionEngine) {
    return 'introspectionEngine'
  }

  if (binaryType === EngineNameEnum.migrationEngine) {
    return 'migrationEngine'
  }
  if (binaryType === EngineNameEnum.libqueryEngine) {
    return 'libqueryEngine'
  }
  if (binaryType === EngineNameEnum.queryEngine) {
    return 'queryEngine'
  }

  if (binaryType === EngineNameEnum.prismaFmt) {
    return 'prismaFmt'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}
