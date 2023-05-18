import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function toolingHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { runtimeBinaryTarget } = input

  return `${queryEngineCannotBeFound(input)}

This is likely caused by tooling that has not copied "${runtimeBinaryTarget}" to the deployment.
Please try to make sure that "${runtimeBinaryTarget}" is copied to "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-tooling-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
