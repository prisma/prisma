import { ErrorBasicBuilder, ErrorWriter } from './base'

export abstract class Value implements ErrorBasicBuilder {
  abstract write(writer: ErrorWriter): void
  abstract getPrintWidth(): number

  public hasError = false

  markAsError(): this {
    this.hasError = true
    return this
  }
}
