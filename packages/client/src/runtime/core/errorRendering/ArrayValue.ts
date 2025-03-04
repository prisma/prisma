import { INDENT_SIZE } from '../../../generation/ts-builders/Writer'
import { ArrayField } from './ArrayField'
import { type ErrorWriter, fieldsSeparator } from './base'
import { FormattedString } from './FormattedString'
import { Value } from './Value'

export class ArrayValue extends Value {
  private items: ArrayField[] = []

  addItem(item: Value): this {
    this.items.push(new ArrayField(item))
    return this
  }

  getField(index: number): ArrayField | undefined {
    return this.items[index]
  }

  override getPrintWidth(): number {
    if (this.items.length === 0) {
      return 2
    }
    const maxItemWidth = Math.max(...this.items.map((item) => item.value.getPrintWidth()))
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

  override asObject(): undefined {
    return undefined
  }
}
