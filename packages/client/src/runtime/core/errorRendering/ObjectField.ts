import { ErrorBasicBuilder, ErrorWriter } from './base'
import { FormattedString } from './FormattedString'
import { Value } from './Value'

const separator = ': '
export class ObjectField implements ErrorBasicBuilder {
  private hasError = false
  constructor(readonly name: string, readonly value: Value) {}

  markAsError() {
    this.hasError = true
  }

  getPrintWidth() {
    return this.name.length + this.value.getPrintWidth() + separator.length
  }

  write(writer: ErrorWriter): void {
    const name = new FormattedString(this.name)
    if (this.hasError) {
      name.underline().setColor(writer.context.colors.red)
    }
    writer.write(name).write(separator).write(this.value)
  }
}
