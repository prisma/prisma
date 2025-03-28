import { NamedType, namedType } from './NamedType'
import { TypeBuilder } from './TypeBuilder'

export function omit(type: TypeBuilder, keyType: TypeBuilder): NamedType {
  return namedType('Omit').addGenericArgument(type).addGenericArgument(keyType)
}
