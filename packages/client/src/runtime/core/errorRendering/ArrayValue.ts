import { INDENT_SIZE } from '../../../generation/ts-builders/Writer'
import { ErrorWriter, fieldsSeparator } from './base'
import { FormattedString } from './FormattedString'
import { Value } from './Value'

export class ArrayValue extends Value {
  private items: Value[] = []

  addItem(item: Value): this {
    this.items.push(item)
    return this
  }

  override getPrintWidth(): number {
    if (this.items.length === 0) {
      return 2
    }
    const maxItemWidth = Math.max(...this.items.map((item) => item.getPrintWidth()))
    return maxItemWidth + INDENT_SIZE
  }

  override write(writer: ErrorWriter): void {
    if (this.items.length === 0) {
      this.writeEmpty(writer)
      return
    }
    this.writeWithItems(writer)
  }

  private writeEmpty(writer: ErrorWriter) {
    const output = new FormattedString('[]')
    if (this.hasError) {
      output.setColor(writer.context.colors.red).underline()
    }
    writer.write(output)
  }

  private writeWithItems(writer: ErrorWriter) {
    const { colors } = writer.context

    writer
      .writeLine('[')
      .withIndent(() => writer.writeJoined(fieldsSeparator, this.items).newLine())
      .write(']')

    if (this.hasError) {
      writer.afterNextNewline(() => {
        writer.writeLine(colors.red('~'.repeat(this.getPrintWidth())))
      })
    }
  }
}
