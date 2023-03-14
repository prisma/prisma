import { ErrorBasicBuilder, ErrorWriter } from './base'

export class ScalarValue implements ErrorBasicBuilder {
  constructor(readonly text: string) {}

  write(writer: ErrorWriter): void {
    const { chalk } = writer.context
    writer.write(chalk.dim(this.text))
  }
}
