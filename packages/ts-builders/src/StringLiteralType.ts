import { TypeBuilder } from './TypeBuilder'
import { ValueBuilder } from './ValueBuilder'
import { Writer } from './Writer'

export class StringLiteralType extends TypeBuilder {
  constructor(readonly content: string) {
    super()
  }

  write(writer: Writer): void {
    writer.write(JSON.stringify(this.content))
  }

  asValue(): StringLiteralValue {
    return new StringLiteralValue(this)
  }
}

export class StringLiteralValue extends ValueBuilder {
  #type: StringLiteralType

  constructor(type: StringLiteralType) {
    super()
    this.#type = type
  }

  override write(writer: Writer): void {
    writer.write(this.#type)
  }
}

export function stringLiteral(content: string) {
  return new StringLiteralType(content)
}
