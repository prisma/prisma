import { ErrorBasicBuilder, ErrorWriter } from './types'

export class ObjectFieldSuggestion implements ErrorBasicBuilder {
  constructor(readonly name: string, readonly value: string) {}

  write(writer: ErrorWriter): void {
    const { chalk } = writer.context
    writer.addMarginSymbol(chalk.greenBright('?')).write(chalk.greenBright(`${this.name}?: ${this.value}`))
  }
}
