import { GeneratorConfig } from '@prisma/generator'
import { BinaryTarget } from '@prisma/get-platform'

export type EngineNotFoundErrorInput = {
  queryEngineName: string
  generator: GeneratorConfig
  runtimeBinaryTarget: BinaryTarget
  searchedLocations: string[]
  expectedLocation: string
  errorStack: string | undefined
}
