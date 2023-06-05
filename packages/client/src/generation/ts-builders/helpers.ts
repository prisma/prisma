import { NamedType, namedType } from './NamedType'
import { TypeBuilder } from './TypeBuilder'

export function omit(type: TypeBuilder, keyType: TypeBuilder): NamedType {
  return namedType('Omit').addGenericArgument(type).addGenericArgument(keyType)
}

export function promise(resultType: TypeBuilder): NamedType {
  return new NamedType('Promise').addGenericArgument(resultType)
}

export function prismaPromise(resultType: TypeBuilder): NamedType {
  return new NamedType('Prisma.PrismaPromise').addGenericArgument(resultType)
}
