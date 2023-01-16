import { TypeBuilder } from './TypeBuilder'
import { Writer } from './Writer'

export class StringLiteralType extends TypeBuilder {
  constructor(readonly content: string) {
    super()
  }

  write(writer: Writer): void {
    writer.write(JSON.stringify(this.content))
  }
}

export function stringLiteral(content: string) {
  return new StringLiteralType(content)
}
