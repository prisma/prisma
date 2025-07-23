import { NamedType, namedType, TypeBuilder } from '@prisma/ts-builders'

export interface NamespaceMap {
  readonly Types: {
    readonly self: string
    readonly Extensions: string
    readonly Result: string
    readonly Utils: string
  }
  readonly Prisma: string
}

export class TypeBuilders {
  readonly #ns: NamespaceMap

  constructor(ns: NamespaceMap) {
    this.#ns = ns
  }

  get #Prisma() {
    return this.#ns.Prisma
  }

  get #Types() {
    return this.#ns.Types
  }

  omit(type: TypeBuilder, keyType: TypeBuilder): NamedType {
    return namedType('Omit').addGenericArgument(type).addGenericArgument(keyType)
  }

  promise(resultType: TypeBuilder): NamedType {
    return namedType(`${this.#Types.Utils}.JsPromise`).addGenericArgument(resultType)
  }

  prismaPromise(resultType: TypeBuilder): NamedType {
    return namedType(`${this.#Prisma}.PrismaPromise`).addGenericArgument(resultType)
  }

  optional(innerType: TypeBuilder): NamedType {
    return namedType(`${this.#Types.Utils}.Optional`).addGenericArgument(innerType)
  }

  importedType(name: string): NamedType {
    return namedType(`${this.#Types.self}.${name}`)
  }

  importedExtensionsType(name: string): NamedType {
    return namedType(`${this.#Types.Extensions}.${name}`)
  }

  importedResultType(name: string): NamedType {
    return namedType(`${this.#Types.Result}.${name}`)
  }

  prismaType(name: string): NamedType {
    return namedType(`${this.#Prisma}.${name}`)
  }
}
