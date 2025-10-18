import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function nativeGeneratedOnDifferentPlatform(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `${queryEngineCannotBeFound(input)}

This happened because Prisma Client was generated for a different platform, but the actual deployment required "${runtimeBinaryTarget}".

${theseLocationsHaveBeenSearched(input)}`
}
