import { ErrorBasicBuilder, ErrorWriter, fieldsSeparator } from './base'

export class SuggestionObjectValue implements ErrorBasicBuilder {
  private fields: ErrorBasicBuilder[] = []

  addField(name: string, value: string) {
    this.fields.push({
      write(writer) {
        const { green, dim } = writer.context.colors
        writer.write(green(dim(`${name}: ${value}`))).addMarginSymbol(green(dim('+')))
      },
    })
    return this
  }

  write(writer: ErrorWriter): void {
    const {
      colors: { green },
    } = writer.context
    writer
      .writeLine(green('{'))
      .withIndent(() => {
        writer.writeJoined(fieldsSeparator, this.fields).newLine()
      })
      .write(green('}'))
      .addMarginSymbol(green('+'))
  }
}
