import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class ArrayType extends TypeBuilder {
  constructor(private elementType: TypeBuilder) {
    super()
  }

  write(writer: Writer): void {
    this.elementType.writeIndexed(writer)

    writer.write('[]')
  }
}

export function array(elementType: TypeBuilder): ArrayType {
  return new ArrayType(elementType)
}
