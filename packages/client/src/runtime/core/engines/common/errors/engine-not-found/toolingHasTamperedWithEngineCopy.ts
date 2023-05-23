import { weWouldAppreciateIfYouCouldShareInfo } from '../weWouldAppreciateIfYouCouldShareInfo'
import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'
import { queryEngineCannotBeFound } from './queryEngineCannotBeFound'
import { theseLocationsHaveBeenSearched } from './theseLocationsHaveBeenSearched'

export function toolingHasTamperedWithEngineCopy(input: EngineNotFoundErrorInput) {
  const { queryEngineName } = input

  return `${queryEngineCannotBeFound(input)}

This is likely caused by tooling that has not copied "${queryEngineName}" to the deployment folder.
Ensure that you ran \`prisma generate\` and that "${queryEngineName}" is copied to "${input.expectedLocation}".

${weWouldAppreciateIfYouCouldShareInfo('engine-not-found-tooling-investigation')}

${theseLocationsHaveBeenSearched(input)}`
}
