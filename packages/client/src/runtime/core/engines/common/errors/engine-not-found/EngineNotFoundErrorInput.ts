import { BinaryTargetsEnvValue, GeneratorConfig } from '@prisma/generator-helper'
import { Platform } from '@prisma/get-platform'

export type EngineNotFoundErrorInput = {
  queryEngineName: string
  generator: GeneratorConfig
  generatorBinaryTargets: BinaryTargetsEnvValue[]
  runtimeBinaryTarget: Platform
  searchedLocations: string[]
  expectedLocation: string
}
