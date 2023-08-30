import { BasicBuilder } from './BasicBuilder'
import { NamedType } from './NamedType'
import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class GenericParameter implements BasicBuilder {
  private extendedType?: TypeBuilder
  private defaultType?: TypeBuilder

  constructor(private name: string) {}

  extends(type: TypeBuilder): this {
    this.extendedType = type
    return this
  }

  default(type: TypeBuilder): this {
    this.defaultType = type
    return this
  }

  toArgument(): NamedType {
    return new NamedType(this.name)
  }

  write(writer: Writer): void {
    writer.write(this.name)
    if (this.extendedType) {
      writer.write(' extends ').write(this.extendedType)
    }
    if (this.defaultType) {
      writer.write(' = ').write(this.defaultType)
    }
  }
}

export function genericParameter(name: string): GenericParameter {
  return new GenericParameter(name)
}
