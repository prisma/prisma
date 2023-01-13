import { BasicBuilder } from './BasicBuilder'
import { KeyType } from './KeyType'
import { Writer } from './Writer'

export abstract class TypeBuilder implements BasicBuilder {
  needsParenthesisWhenIndexed = false

  abstract write(writer: Writer): void

  subKey(key: string): KeyType {
    return new KeyType(this, key)
  }

  writeIndexed(writer: Writer) {
    if (this.needsParenthesisWhenIndexed) {
      writer.write('(')
    }

    writer.write(this)

    if (this.needsParenthesisWhenIndexed) {
      writer.write(')')
    }
  }
}
