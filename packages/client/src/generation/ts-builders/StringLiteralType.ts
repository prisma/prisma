import { BasicBuilder } from './BasicBuilder'
import { Writer } from './Writer'

export class StringLiteralType implements BasicBuilder {
  constructor(readonly content: string) {}
  write(writer: Writer): void {
    writer.write(JSON.stringify(this.content))
  }
}

export function stringLiteral(content: string) {
  return new StringLiteralType(content)
}
