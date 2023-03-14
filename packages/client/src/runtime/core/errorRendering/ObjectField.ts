import { ErrorBasicBuilder, ErrorWriter } from './base'
import { FormattedString } from './FormattedString'
import { Value } from './Value'

export class ObjectField implements ErrorBasicBuilder {
  private hasError = false
  constructor(readonly name: string, readonly value: Value) {}

  markAsError() {
    this.hasError = true
  }
  write(writer: ErrorWriter): void {
    const name = new FormattedString(this.name)
    if (this.hasError) {
      name.underline().setColor(writer.context.chalk.redBright)
    }
    writer.write(name).write(': ').write(this.value)
  }
}
