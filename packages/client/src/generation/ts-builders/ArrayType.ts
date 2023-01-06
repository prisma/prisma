import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { FunctionType } from './FunctionType'
import { ObjectType } from './ObjectType'
import { UnionType } from './UnionType'
import { Writer } from './Writer'

export class ArrayType implements BasicBuilder {
  constructor(private elementType: AnyTypeBuilder) {}
  write(writer: Writer): void {
    const needsBraces =
      this.elementType instanceof ObjectType ||
      this.elementType instanceof FunctionType ||
      this.elementType instanceof UnionType

    if (needsBraces) {
      writer.write('(')
    }
    writer.write(this.elementType)

    if (needsBraces) {
      writer.write(')')
    }

    writer.write('[]')
  }
}

export function array(elementType: AnyTypeBuilder): ArrayType {
  return new ArrayType(elementType)
}
