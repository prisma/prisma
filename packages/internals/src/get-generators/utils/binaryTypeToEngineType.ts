import { BinaryType } from '@prisma/fetch-engine'
import type { EngineType } from '@prisma/generator-helper'

export function binaryTypeToEngineType(binaryType: BinaryType): EngineType {
  if (binaryType === BinaryType.SchemaEngineBinary) {
    return 'schemaEngine'
  }
  if (binaryType === BinaryType.QueryEngineLibrary) {
    return 'libqueryEngine'
  }
  if (binaryType === BinaryType.QueryEngineBinary) {
    return 'queryEngine'
  }

  throw new Error(`Could not convert binary type ${binaryType}`)
}
