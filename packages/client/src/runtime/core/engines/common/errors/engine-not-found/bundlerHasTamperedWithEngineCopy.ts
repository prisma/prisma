import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function bundlerHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { queryEngineName } = input

  return `${queryEngineCannotBeFound(input)}

This is likely caused by a bundler that has not copied "${queryEngineName}" next to the resulting bundle.
Please try to make sure that "${queryEngineName}" is copied next to the bundle or in "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-bundler-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
