import { TypeBuilder } from './TypeBuilder'
import type { Writer } from './Writer'

export class KeyofType extends TypeBuilder {
  constructor(public baseType: TypeBuilder) {
    super()
  }

  write(writer: Writer): void {
    writer.write('keyof ')
    if (this.baseType.needsParenthesisInKeyof) {
      writer.write('(').write(this.baseType).write(')')
    } else {
      writer.write(this.baseType)
    }
  }
}

export function keyOfType(baseType: TypeBuilder): KeyofType {
  return new KeyofType(baseType)
}
