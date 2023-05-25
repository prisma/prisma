import { printGeneratorConfig } from '@prisma/internals'

import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'

export function addRuntimeToYourBinaryTargets(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `Add "${runtimeBinaryTarget}" to \`binaryTargets\` in the "schema.prisma" file and run \`prisma generate\` after saving it:

${getGeneratorBlockSuggestion(input)}`
}

function getGeneratorBlockSuggestion(input: EngineNotFoundErrorInput) {
  const { generator, generatorBinaryTargets, runtimeBinaryTarget } = input
  const suggestedBinaryTarget = { fromEnvVar: null, value: runtimeBinaryTarget }
  const binaryTargets = [...generatorBinaryTargets, suggestedBinaryTarget]

  return printGeneratorConfig({ ...generator, binaryTargets })
}
