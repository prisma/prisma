import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import type { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { howToFixEngineNotFoundNextjs } from './howToFixEngineNotFoundNextjs'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function bundlerHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { queryEngineName } = input

  return `${queryEngineCannotBeFound(input)}${howToFixEngineNotFoundNextjs(input)}

This is likely caused by a bundler that has not copied "${queryEngineName}" next to the resulting bundle.
Ensure that "${queryEngineName}" has been copied next to the bundle or in "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-bundler-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
