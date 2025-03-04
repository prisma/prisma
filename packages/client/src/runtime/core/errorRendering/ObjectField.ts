import type { ErrorBasicBuilder, ErrorWriter } from './base'
import type { Field } from './Field'
import { FormattedString } from './FormattedString'
import type { Value } from './Value'

const separator = ': '
export class ObjectField implements ErrorBasicBuilder, Field {
  hasError = false
  constructor(
    readonly name: string,
    public value: Value,
  ) {}

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
