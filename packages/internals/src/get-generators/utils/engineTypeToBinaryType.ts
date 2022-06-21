import { BinaryType } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function engineTypeToBinaryType(engineType: EngineType): BinaryType {
  if (engineType === 'introspectionEngine') {
    return BinaryType.introspectionEngine
  }

  if (engineType === 'migrationEngine') {
    return BinaryType.migrationEngine
  }

  if (engineType === 'queryEngine') {
    return BinaryType.queryEngine
  }
  if (engineType === 'libqueryEngine') {
    return BinaryType.libqueryEngine
  }
  if (engineType === 'prismaFmt') {
    return BinaryType.prismaFmt
  }

  throw new Error(`Could not convert engine type ${engineType}`)
}
