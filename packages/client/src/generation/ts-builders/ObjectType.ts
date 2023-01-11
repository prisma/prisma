import { BasicBuilder } from './BasicBuilder'
import { Method } from './Method'
import { Property } from './Property'
import { Writer } from './Writer'

type ObjectTypeItem = Method | Property

export class ObjectType implements BasicBuilder {
  private items: ObjectTypeItem[] = []
  private inline = false

  add(item: ObjectTypeItem): this {
    this.items.push(item)
    return this
  }

  formatInline() {
    this.inline = true
    return this
  }

  write(writer: Writer): void {
    if (this.items.length === 0) {
      writer.write('{}')
    } else if (this.inline) {
      this.writeInline(writer)
    } else {
      this.writeMultiline(writer)
    }
  }

  private writeMultiline(writer: Writer) {
    writer
      .writeLine('{')
      .withIndent(() => {
        for (const item of this.items) {
          writer.writeLine(item)
        }
      })
      .write('}')
  }

  private writeInline(writer: Writer) {
    writer.write('{ ').writeJoined(', ', this.items).write(' }')
  }
}

export function objectType() {
  return new ObjectType()
}
