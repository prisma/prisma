import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class ArrayType extends TypeBuilder {
  private isReadOnly: boolean = false
  constructor(private elementType: TypeBuilder) {
    super()
  }

  readonly(): ArrayType {
    this.isReadOnly = true
    return this
  }

  write(writer: Writer): void {
    if (this.isReadOnly) writer.write('readonly ')

    this.elementType.writeIndexed(writer)

    writer.write('[]')
  }
}

export function array(elementType: TypeBuilder): ArrayType {
  return new ArrayType(elementType)
}
