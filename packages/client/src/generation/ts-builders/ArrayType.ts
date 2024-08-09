import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class ArrayType extends TypeBuilder {
  private isReadonly = false
  constructor(private elementType: TypeBuilder) {
    super()
  }

  readonly(): this {
    this.isReadonly = true
    return this
  }

  write(writer: Writer): void {
    if (this.isReadonly) {
      writer.write('readonly ')
    }

    this.elementType.writeIndexed(writer)

    writer.write('[]')
  }
}

export function array(elementType: TypeBuilder): ArrayType {
  return new ArrayType(elementType)
}
