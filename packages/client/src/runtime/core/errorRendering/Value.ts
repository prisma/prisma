import type { ErrorBasicBuilder, ErrorWriter } from './base'
import type { ObjectValue } from './ObjectValue'

export abstract class Value implements ErrorBasicBuilder {
  abstract write(writer: ErrorWriter): void

  /**
   * Returns total width the value when it is rendered. Used
   * for determining underline width.
   */
  abstract getPrintWidth(): number

  public hasError = false

  markAsError(): this {
    this.hasError = true
    return this
  }

  abstract asObject(): ObjectValue | undefined
}
