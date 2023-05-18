import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function bundlerHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { queryEngineName } = input

  return `${queryEngineCannotBeFound(input)}

This is likely caused by a bundler that has not copied "${queryEngineName}" near the resulting bundle.
Please try to make sure that "${queryEngineName}" is copied to "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-bundler-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
