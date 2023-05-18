import { fixBinaryTargets, printGeneratorConfig } from '@prisma/internals'

import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'

export function addRuntimeToYourBinaryTargets(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `Add "${runtimeBinaryTarget}" to \`binaryTargets\` in the "schema.prisma" file and run \`prisma generate\` after saving it:

${getGeneratorBlockSuggestion(input)}`
}

function getGeneratorBlockSuggestion(input: EngineNotFoundErrorInput) {
  const { generator, generatorBinaryTargets, runtimeBinaryTarget } = input

  const fixedGenerator = {
    ...generator,
    binaryTargets: fixBinaryTargets(generatorBinaryTargets, runtimeBinaryTarget),
  }

  return printGeneratorConfig(fixedGenerator)
}
