import { NamedType, namedType, TypeBuilder } from '@prisma/ts-builders'

export function omit(type: TypeBuilder, keyType: TypeBuilder): NamedType {
  return namedType('Omit').addGenericArgument(type).addGenericArgument(keyType)
}

export function promise(resultType: TypeBuilder): NamedType {
  return new NamedType('runtime.Types.Utils.JsPromise').addGenericArgument(resultType)
}

export function prismaPromise(resultType: TypeBuilder): NamedType {
  return new NamedType('Prisma.PrismaPromise').addGenericArgument(resultType)
}

export function optional(innerType: TypeBuilder) {
  return new NamedType('runtime.Types.Utils.Optional').addGenericArgument(innerType)
}
