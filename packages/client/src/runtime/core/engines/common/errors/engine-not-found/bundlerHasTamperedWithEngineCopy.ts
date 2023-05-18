import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function bundlerHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `${queryEngineCannotBeFound(input)}

This is likely caused by a bundler that has not copied "${runtimeBinaryTarget}" near the resulting bundle.
Please try to make sure that "${runtimeBinaryTarget}" is copied to "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-bundler-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
