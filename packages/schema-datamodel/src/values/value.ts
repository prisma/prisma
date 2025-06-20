import { Text } from './text'
import { Constant } from './constant'
import { Function } from './function'
import { Env } from './env'

/**
 * A PSL value representation.
 * Equivalent to Rust's Value<'a> enum.
 */
export class Value {
  private constructor(
    private readonly type: 'text' | 'bytes' | 'constant' | 'array' | 'function' | 'env',
    private readonly value: Text | Constant | Array<Value> | Function | Env | string
  ) { }

  /**
   * Create a string value, quoted and escaped accordingly.
   */
  public static text(value: string): Value {
    return new Value('text', Text.create(value))
  }

  /**
   * Create a byte value, quoted and base64-encoded.
   */
  public static bytes(value: Uint8Array): Value {
    // Convert to base64
    const base64 = Buffer.from(value).toString('base64')
    return new Value('bytes', Text.create(base64))
  }

  /**
   * Create a constant value without quoting.
   */
  public static constant(value: string | number | boolean): Value {
    return new Value('constant', Constant.create(value))
  }

  /**
   * Create an array of values.
   */
  public static array(values: Value[]): Value {
    return new Value('array', values)
  }

  /**
   * Create a function has a name, and optionally named parameters.
   */
  public static function(func: Function): Value {
    return new Value('function', func)
  }

  /**
   * Create a value that can be read from the environment.
   */
  public static env(env: Env): Value {
    return new Value('env', env)
  }

  public toString(): string {
    if (this.value instanceof Text ||
      this.value instanceof Constant ||
      this.value instanceof Array ||
      this.value instanceof Function ||
      this.value instanceof Env) {
      return this.value.toString()
    }
    return String(this.value)
  }

  public getType(): 'text' | 'bytes' | 'constant' | 'array' | 'function' | 'env' {
    return this.type
  }

  public getValue(): Text | Constant | Array<Value> | Function | Env | string {
    return this.value
  }

  /**
   * Type guard to check if this is a text value
   */
  public isText(): this is Value & { getValue(): Text } {
    return this.type === 'text'
  }

  /**
   * Type guard to check if this is a constant value
   */
  public isConstant(): this is Value & { getValue(): Constant } {
    return this.type === 'constant'
  }

  /**
   * Type guard to check if this is an array value
   */
  public isArray(): this is Value & { getValue(): Array<Value> } {
    return this.type === 'array'
  }

  /**
   * Type guard to check if this is a function value
   */
  public isFunction(): this is Value & { getValue(): Function } {
    return this.type === 'function'
  }

  /**
   * Type guard to check if this is an env value
   */
  public isEnv(): this is Value & { getValue(): Env } {
    return this.type === 'env'
  }
}