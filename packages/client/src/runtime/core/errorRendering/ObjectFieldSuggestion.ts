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
    const {
      colors: { green },
    } = writer.context

    writer.addMarginSymbol(green(this.isRequired ? '+' : '?'))
    writer.write(green(this.name))

    if (!this.isRequired) {
      writer.write(green('?'))
    }

    writer.write(green(`: `))
    if (typeof this.value === 'string') {
      writer.write(green(this.value))
    } else {
      writer.write(this.value)
    }
  }
}
