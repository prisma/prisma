import { AnyTypeBuilder } from './AnyTypeBuilder'
import { BasicBuilder } from './BasicBuilder'
import { FunctionType } from './FunctionType'
import { ObjectType } from './ObjectType'
import { UnionType } from './UnionType'
import { Writer } from './Writer'

export class KeyType implements BasicBuilder {
  constructor(public baseType: AnyTypeBuilder, public key: string) {}
  write(writer: Writer): void {
    const needsBraces =
      this.baseType instanceof ObjectType || this.baseType instanceof FunctionType || this.baseType instanceof UnionType

    if (needsBraces) {
      writer.write('(')
    }

    writer.write(this.baseType)

    if (needsBraces) {
      writer.write(')')
    }

    writer.write('[').write(`"${this.key}"`).write(']')
  }

  subKey(key: string): KeyType {
    return new KeyType(this, key)
  }
}

export function keyType(baseType: AnyTypeBuilder, key: string) {
  return new KeyType(baseType, key)
}
