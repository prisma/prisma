import { Value } from './value'

/**
 * Represents a function parameter in the PSL.
 * Equivalent to Rust's FunctionParam<'a> enum.
 */
export type FunctionParam =
  | { type: 'keyValue'; key: string; value: Value }
  | { type: 'onlyValue'; value: Value }

/**
 * Represents a function value in the PSL.
 * Equivalent to Rust's Function<'a> struct.
 */
export class Function {
  private params: FunctionParam[] = []
  private renderEmptyParentheses = false

  constructor(private readonly name: string) { }

  /**
   * Add a new parameter to the function. If no parameters are
   * added, the parentheses are not rendered unless explicitly requested.
   */
  public pushParam(param: Value | string | number | boolean): this
  public pushParam(key: string, value: Value | string | number | boolean): this
  public pushParam(
    keyOrParam: string | Value | number | boolean,
    value?: Value | string | number | boolean
  ): this {
    if (value !== undefined) {
      // Key-value parameter
      const key = keyOrParam as string
      this.params.push({
        type: 'keyValue',
        key,
        value: this.normalizeValue(value)
      })
    } else {
      // Only value parameter
      this.params.push({
        type: 'onlyValue',
        value: this.normalizeValue(keyOrParam as Value | string | number | boolean)
      })
    }
    return this
  }

  private normalizeValue(value: Value | string | number | boolean): Value {
    if (value instanceof Value) {
      return value
    }
    if (typeof value === 'string') {
      return Value.text(value)
    }
    return Value.constant(value)
  }

  /**
   * Force rendering of empty parentheses even when no parameters are present.
   */
  public setRenderEmptyParentheses(render: boolean = true): this {
    this.renderEmptyParentheses = render
    return this
  }

  public toString(): string {
    let result = this.name

    if (this.params.length > 0 || this.renderEmptyParentheses) {
      result += '('
    }

    if (this.params.length > 0) {
      const paramStrings = this.params.map(param => {
        if (param.type === 'keyValue') {
          return `${param.key}: ${param.value.toString()}`
        }
        return param.value.toString()
      })
      result += paramStrings.join(', ')
    }

    if (this.params.length > 0 || this.renderEmptyParentheses) {
      result += ')'
    }

    return result
  }

  public static create(name: string): Function {
    return new Function(name)
  }

  public getName(): string {
    return this.name
  }

  public getParams(): readonly FunctionParam[] {
    return this.params
  }
}