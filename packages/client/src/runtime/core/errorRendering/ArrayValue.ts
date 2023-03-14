import { ErrorBasicBuilder, ErrorWriter, fieldsSeparator } from './base'
import { Value } from './Value'

export class ArrayValue implements ErrorBasicBuilder {
  private items: Value[] = []

  addItem(item: Value): this {
    this.items.push(item)
    return this
  }

  write(writer: ErrorWriter): void {
    if (this.items.length === 0) {
      writer.write('[]')
      return
    }

    writer.writeLine('[').writeJoined(fieldsSeparator, this.items).write(']')
  }
}
