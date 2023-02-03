import { ErrorBasicBuilder, ErrorWriter } from './types'
import { Value } from './Value'

const fieldsSeparator: ErrorBasicBuilder = {
  write(writer) {
    writer.writeLine(',')
  },
}

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
