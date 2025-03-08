import type { BinaryTargetsEnvValue, GeneratorConfig } from '@prisma/generator-helper'
import type { BinaryTarget } from '@prisma/get-platform'

export type EngineNotFoundErrorInput = {
  queryEngineName: string
  generator: GeneratorConfig
  generatorBinaryTargets: BinaryTargetsEnvValue[]
  runtimeBinaryTarget: BinaryTarget
  searchedLocations: string[]
  expectedLocation: string
  errorStack: string | undefined
}
