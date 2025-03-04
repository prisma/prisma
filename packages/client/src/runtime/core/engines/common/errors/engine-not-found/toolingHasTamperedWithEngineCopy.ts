import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import type { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { howToFixEngineNotFoundNextjs } from './howToFixEngineNotFoundNextjs'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function toolingHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { queryEngineName } = input

  return `${queryEngineCannotBeFound(input)}${howToFixEngineNotFoundNextjs(input)}

This is likely caused by tooling that has not copied "${queryEngineName}" to the deployment folder.
Ensure that you ran \`prisma generate\` and that "${queryEngineName}" has been copied to "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-tooling-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
