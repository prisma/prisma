import { NamedType, TypeBuilder } from '@prisma/ts-builders'

export function promise(resultType: TypeBuilder): NamedType {
  return new NamedType('$Utils.JsPromise').addGenericArgument(resultType)
}

export function prismaPromise(resultType: TypeBuilder): NamedType {
  return new NamedType('Prisma.PrismaPromise').addGenericArgument(resultType)
}

export function optional(innerType: TypeBuilder) {
  return new NamedType('$Utils.Optional').addGenericArgument(innerType)
}
