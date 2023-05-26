import { addRuntimeToYourBinaryTargets } from './addRuntimeToYourBinaryTargets'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function nativeGeneratedOnDifferentPlatform(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget, generatorBinaryTargets } = input
  const nativeBinaryTarget = generatorBinaryTargets.find((bt) => bt.native)

  return `${queryEngineCannotBeFound(input)}

This happened because Prisma Client was generated for "${
    nativeBinaryTarget?.value ?? 'unknown'
  }", but the actual deployment required "${runtimeBinaryTarget}".
${addRuntimeToYourBinaryTargets(input)}

${theseLocationsHaveBeenSearched(input)}`
}
