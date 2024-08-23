import { isIdentifierName } from '@babel/helper-validator-identifier'

export function isValidJsIdentifier(str: string): boolean {
  return isIdentifierName(str)
}
