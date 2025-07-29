import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class KeyType extends TypeBuilder {
  constructor(public baseType: TypeBuilder, public key: string) {
    super()
  }
  write(writer: Writer): void {
    this.baseType.writeIndexed(writer)

    writer.write('[').write(`"${this.key}"`).write(']')
  }
}

export function keyType(baseType: TypeBuilder, key: string) {
  return new KeyType(baseType, key)
}
