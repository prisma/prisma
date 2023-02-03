import type { BasicBuilder } from './BasicBuilder'

const INDENT_SIZE = 2
export class Writer<ContextType = undefined> {
  private lines: string[] = []
  private currentLine = ''
  private currentIndent = 0
  private marginSymbol?: string
  private afterNextNewLineCallback?: () => void

  constructor(startingIndent = 0, readonly context: ContextType) {
    this.currentIndent = startingIndent
  }

  write(value: string | BasicBuilder<ContextType>): this {
    if (typeof value === 'string') {
      this.currentLine += value
    } else {
      value.write(this)
    }
    return this
  }

  writeJoined(separator: string | BasicBuilder<ContextType>, values: Array<string | BasicBuilder<ContextType>>): this {
    const last = values.length - 1
    for (let i = 0; i < values.length; i++) {
      this.write(values[i])
      if (i !== last) {
        this.write(separator)
      }
    }
    return this
  }

  writeLine(line: string | BasicBuilder<ContextType>): this {
    return this.write(line).newLine()
  }

  newLine(): this {
    this.lines.push(this.indentedCurrentLine())
    this.currentLine = ''
    this.marginSymbol = undefined

    const afterNextNewLineCallback = this.afterNextNewLineCallback
    this.afterNextNewLineCallback = undefined
    afterNextNewLineCallback?.()
    return this
  }

  withIndent(callback: (writer: this) => void): this {
    this.indent()
    callback(this)
    this.unindent()
    return this
  }

  afterNextNewline(callback: () => void) {
    this.afterNextNewLineCallback = callback
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

  addMarginSymbol(symbol: string): this {
    this.marginSymbol = symbol
    return this
  }

  toString() {
    return this.lines.concat(this.indentedCurrentLine()).join('\n')
  }

  private indentedCurrentLine(): string {
    const line = this.currentLine.padStart(this.currentLine.length + INDENT_SIZE * this.currentIndent)
    if (this.marginSymbol) {
      return this.marginSymbol + line.slice(1)
    }
    return line
  }
}
