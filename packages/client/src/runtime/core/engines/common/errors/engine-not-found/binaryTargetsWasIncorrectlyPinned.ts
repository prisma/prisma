import { addRuntimeToYourBinaryTargets } from './addRuntimeToYourBinaryTargets'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function binaryTargetsWasIncorrectlyPinned(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `${queryEngineCannotBeFound(input)}

This happened because \`binaryTargets\` have been pinned, but the actual deployment also required "${runtimeBinaryTarget}".
${addRuntimeToYourBinaryTargets(input)}

${theseLocationsHaveBeenSearched(input)}`
}
