import { EngineNotFoundErrorInput } from './EngineNotFoundErrorInput'

export function theseLocationsHaveBeenSearched(input: EngineNotFoundErrorInput) {
  const { searchedLocations } = input

  const uniqueSearchLocations = [...new Set(searchedLocations)]
  const formattedSearchLocations = uniqueSearchLocations.map((location) => `  ${location}`).join('\n')

  return `The following locations have been searched:
${formattedSearchLocations}`
}
