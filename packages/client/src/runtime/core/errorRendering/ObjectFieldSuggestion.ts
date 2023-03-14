import { ErrorBasicBuilder, ErrorWriter } from './base'
import { SuggestionObjectValue } from './SuggestionObjectValue'

export class ObjectFieldSuggestion implements ErrorBasicBuilder {
  public isRequired = false
  constructor(readonly name: string, readonly value: string | SuggestionObjectValue) {}

  makeRequired() {
    this.isRequired = true
    return this
  }

  write(writer: ErrorWriter): void {
    const { chalk } = writer.context

    writer.addMarginSymbol(chalk.greenBright(this.isRequired ? '+' : '?'))
    writer.write(chalk.greenBright(this.name))

    if (!this.isRequired) {
      writer.write(chalk.greenBright('?'))
    }

    writer.write(chalk.greenBright(`: `))
    if (typeof this.value === 'string') {
      writer.write(chalk.greenBright(this.value))
    } else {
      writer.write(this.value)
    }
  }
}
