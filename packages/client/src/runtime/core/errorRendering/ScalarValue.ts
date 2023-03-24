import { ErrorWriter } from './base'
import { FormattedString } from './FormattedString'
import { Value } from './Value'

export class ScalarValue extends Value {
  constructor(readonly text: string) {
    super()
  }

  override getPrintWidth(): number {
    return this.text.length
  }

  override write(writer: ErrorWriter): void {
    const string = new FormattedString(this.text)
    if (this.hasError) {
      string.underline().setColor(writer.context.chalk.redBright)
    }
    writer.write(string)
  }
}
