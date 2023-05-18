import { addRuntimeToYourBinaryTargets } from './addRuntimeToYourBinaryTargets'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function nativeGeneratedOnDifferentPlatform(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget, generatorBinaryTargets } = input
  const nativeBinaryTarget = generatorBinaryTargets.filter((bt) => bt.native === true)?.[0]

  return `${queryEngineCannotBeFound(input)}

This happened because Prisma Client generated with "${nativeBinaryTarget}", but the actual deployment required "${runtimeBinaryTarget}".
${addRuntimeToYourBinaryTargets(input)}

${theseLocationsHaveBeenSearched(input)}`
}
