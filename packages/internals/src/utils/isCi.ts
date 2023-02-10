import { hasCiVariable } from './hasCiVariable'

// Returns true if the current environment is a CI environment.
export const isCi = (): boolean => {
  return !!hasCiVariable()
}
