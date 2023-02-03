import { ErrorBasicBuilder, ErrorWriter } from './types'

export type ColorFn = (str: string) => string

export class FormattedString implements ErrorBasicBuilder {
  private isUnderlined: boolean = false
  private color: ColorFn = (str) => str
  constructor(public contents: string) {}

  underline(): this {
    this.isUnderlined = true
    return this
  }

  setColor(color: ColorFn): this {
    this.color = color
    return this
  }

  write(writer: ErrorWriter): void {
    writer.write(this.color(this.contents))
    if (this.isUnderlined) {
      writer.afterNextNewline(() => {
        writer.writeLine(this.color('~'.repeat(this.contents.length)))
      })
    }
  }
}
