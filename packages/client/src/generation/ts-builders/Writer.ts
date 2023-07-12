import type { BasicBuilder } from './BasicBuilder'

export const INDENT_SIZE = 2
/**
 * Helper class for building long multi-line formatted strings from building blocks.
 * Can use either plain strings or `Builder` objects, that would encapsulate formatting logic.
 */
export class Writer<ContextType = undefined> {
  private lines: string[] = []
  private currentLine = ''
  private currentIndent = 0
  private marginSymbol?: string
  private afterNextNewLineCallback?: () => void

  constructor(startingIndent = 0, readonly context: ContextType) {
    this.currentIndent = startingIndent
  }

  /**
   * Adds provided value to the current line. Does not end the line.
   *
   * @param value
   * @returns
   */
  write(value: string | BasicBuilder<ContextType>): this {
    if (typeof value === 'string') {
      this.currentLine += value
    } else {
      value.write(this)
    }
    return this
  }

  /**
   * Adds several `values` to the current line, separated by `separator`. Both values and separator
   * can also be `Builder` instances for more advanced formatting.
   *
   * @param separator
   * @param values
   * @returns
   */
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

  /**
   * Adds a string to current line, flushes current line and starts a new line.
   * @param line
   * @returns
   */
  writeLine(line: string | BasicBuilder<ContextType>): this {
    return this.write(line).newLine()
  }

  /**
   * Flushes current line and starts a new line. New line starts at previously configured indentation level
   * @returns
   */
  newLine(): this {
    this.lines.push(this.indentedCurrentLine())
    this.currentLine = ''
    this.marginSymbol = undefined

    const afterNextNewLineCallback = this.afterNextNewLineCallback
    this.afterNextNewLineCallback = undefined
    afterNextNewLineCallback?.()
    return this
  }

  /**
   * Increases indentation level by 1, calls provided callback and then decreases indentation again.
   * Could be used for writing indented blocks of text:
   *
   * @example
   * ```ts
   * writer
   *   .writeLine('{')
   *   .withIndent(() => {
   *      writer.writeLine('foo: 123');
   *      writer.writeLine('bar: 456');
   *   })
   *   .writeLine('}')
   * ```
   * @param callback
   * @returns
   */
  withIndent(callback: (writer: this) => void): this {
    this.indent()
    callback(this)
    this.unindent()
    return this
  }

  /**
   * Calls provided callback next time when new line is started.
   * Callback is called after old line have already been flushed and a new
   * line have been started. Can be used for adding "between the lines" decorations,
   * such as underlines.
   *
   * @param callback
   * @returns
   */
  afterNextNewline(callback: () => void) {
    this.afterNextNewLineCallback = callback
    return this
  }

  /**
   * Increases indentation level of the current line by 1
   * @returns
   */
  indent(): this {
    this.currentIndent++
    return this
  }

  /**
   * Decreases indentation level of the current line by 1, if it is possible
   * @returns
   */
  unindent(): this {
    if (this.currentIndent > 0) {
      this.currentIndent--
    }
    return this
  }

  /**
   * Adds a symbol, that will replace the first character of the current line (including indentation)
   * when it is flushed. Can be used for adding markers to the line.
   *
   * Note: if indentation level of the line is 0, it will replace the first actually printed character
   * of the line. Use with caution.
   * @param symbol
   * @returns
   */
  addMarginSymbol(symbol: string): this {
    this.marginSymbol = symbol
    return this
  }

  toString() {
    return this.lines.concat(this.indentedCurrentLine()).join('\n')
  }

  getCurrentLineLength() {
    return this.currentLine.length
  }

  private indentedCurrentLine(): string {
    const line = this.currentLine.padStart(this.currentLine.length + INDENT_SIZE * this.currentIndent)
    if (this.marginSymbol) {
      return this.marginSymbol + line.slice(1)
    }
    return line
  }
}
