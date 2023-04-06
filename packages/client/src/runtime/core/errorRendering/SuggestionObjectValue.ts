import { ErrorBasicBuilder, ErrorWriter, fieldsSeparator } from './base'

export class SuggestionObjectValue implements ErrorBasicBuilder {
  private fields: ErrorBasicBuilder[] = []

  addField(name: string, value: string) {
    this.fields.push({
      write(writer) {
        const chalk = writer.context.chalk
        writer.write(chalk.greenBright.dim(`${name}: ${value}`)).addMarginSymbol(chalk.greenBright.dim('+'))
      },
    })
    return this
  }

  write(writer: ErrorWriter): void {
    const { chalk } = writer.context
    writer
      .writeLine(chalk.greenBright('{'))
      .withIndent(() => {
        writer.writeJoined(fieldsSeparator, this.fields).newLine()
      })
      .write(chalk.greenBright('}'))
      .addMarginSymbol(chalk.greenBright('+'))
  }
}
