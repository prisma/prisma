// we could use "is-identifier" package instead after
// node 16 support is no longer necessary
import identifierRegex from 'identifier-regex'

export function isValidJsIdentifier(str: string): boolean {
  return identifierRegex().test(str)
}
