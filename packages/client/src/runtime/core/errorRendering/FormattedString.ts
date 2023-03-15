import { ErrorBasicBuilder, ErrorWriter } from './base'

export type ColorFn = (str: string) => string

export class FormattedString implements ErrorBasicBuilder {
  private isUnderlined = false
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
    const paddingSize = writer.getCurrentLineLength()
    writer.write(this.color(this.contents))
    if (this.isUnderlined) {
      writer.afterNextNewline(() => {
        writer.write(' '.repeat(paddingSize)).writeLine(this.color('~'.repeat(this.contents.length)))
      })
    }
  }
}
