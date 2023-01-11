import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class NamedType implements BasicBuilder {
  readonly genericArguments: AnyTypeBuilder[] = []

  constructor(readonly name: string) {}

  addGenericArgument(type: AnyTypeBuilder): this {
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

export function promise(resultType: AnyTypeBuilder): NamedType {
  return new NamedType('Promise').addGenericArgument(resultType)
}

export function prismaPromise(resultType: AnyTypeBuilder): NamedType {
  return new NamedType('PrismaPromise').addGenericArgument(resultType)
}
