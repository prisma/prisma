import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class NamedType extends TypeBuilder {
  readonly genericArguments: TypeBuilder[] = []

  constructor(readonly name: string) {
    super()
  }

  addGenericArgument(type: TypeBuilder): this {
    this.genericArguments.push(type)
    return this
  }

  write(writer: Writer): void {
    writer.write(this.name)
    if (this.genericArguments.length > 0) {
      writer.write('<').writeJoined(', ', this.genericArguments).write('>')
    }
  }
}

export function namedType(name: string): NamedType {
  return new NamedType(name)
}

export function promise(resultType: TypeBuilder): NamedType {
  return new NamedType('Promise').addGenericArgument(resultType)
}

export function prismaPromise(resultType: TypeBuilder): NamedType {
  return new NamedType('Prisma.PrismaPromise').addGenericArgument(resultType)
}
