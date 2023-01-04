import type { BasicBuilder } from './BasicBuilder'

const INDENT_SIZE = 2
export class Writer {
  private lines: string[] = []
  private currentLine = ''
  private currentIndent = 0

  constructor(startingIndent = 0) {
    this.currentIndent = startingIndent
  }

  write(value: string | BasicBuilder): this {
    if (typeof value === 'string') {
      this.currentLine += value
    } else {
      value.write(this)
    }
    return this
  }

  writeJoined(separator: string | BasicBuilder, values: Array<string | BasicBuilder>): this {
    const last = values.length - 1
    for (let i = 0; i < values.length; i++) {
      this.write(values[i])
      if (i !== last) {
        this.write(separator)
      }
    }
    return this
  }

  writeLine(line: string | BasicBuilder): this {
    return this.write(line).newLine()
  }

  newLine(): this {
    this.lines.push(this.indentedCurrentLine())
    this.currentLine = ''
    return this
  }

  withIndent(callback: (writer: this) => void): this {
    this.indent()
    callback(this)
    this.unindent()
    return this
  }

  indent(): this {
    this.currentIndent++
    return this
  }

  unindent(): this {
    if (this.currentIndent > 0) {
      this.currentIndent--
    }
    return this
  }

  toString() {
    return this.lines.concat(this.indentedCurrentLine()).join('\n')
  }

  private indentedCurrentLine(): string {
    return this.currentLine.padStart(this.currentLine.length + INDENT_SIZE * this.currentIndent)
  }
}
