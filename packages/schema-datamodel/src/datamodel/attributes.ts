import { Function } from '../values'

/**
 * Defines a field attribute, wrapping a function.
 * 
 * Example:
 * ```
 * model X {
 *   field Int @map("FiElD")
 *             ^^^^^^^^^^^^^ this
 * }
 * ```
 */
export class FieldAttribute {
  private prefix?: string

  constructor(private readonly attribute: Function) { }

  /**
   * Adds a prefix to the field attribute. Useful for native types,
   * e.g. `attr.prefix("db")` for a type attribute renders as `@db.Type`.
   */
  public setPrefix(prefix: string): this {
    this.prefix = prefix
    return this
  }

  /**
   * Add a new parameter to the attribute function.
   */
  public pushParam(param: string | number | boolean): this
  public pushParam(key: string, value: string | number | boolean): this
  public pushParam(
    keyOrParam: string | number | boolean,
    value?: string | number | boolean
  ): this {
    if (value !== undefined) {
      this.attribute.pushParam(keyOrParam as string, value)
    } else {
      this.attribute.pushParam(keyOrParam)
    }
    return this
  }

  public toString(): string {
    let result = '@'

    if (this.prefix) {
      result += this.prefix + '.'
    }

    result += this.attribute.toString()

    return result
  }

  public static create(attribute: Function): FieldAttribute {
    return new FieldAttribute(attribute)
  }

  public getFunction(): Function {
    return this.attribute
  }

  public getPrefix(): string | undefined {
    return this.prefix
  }
}

/**
 * Defines a block attribute, wrapping a function.
 * 
 * Example:
 * ```
 * model X {
 *   @@map("model_x")
 *   ^^^^^^^^^^^^^^^^ this
 * }
 * ```
 */
export class BlockAttribute {
  constructor(private readonly attribute: Function) { }

  /**
   * Add a new parameter to the attribute function.
   */
  public pushParam(param: string | number | boolean): this
  public pushParam(key: string, value: string | number | boolean): this
  public pushParam(
    keyOrParam: string | number | boolean,
    value?: string | number | boolean
  ): this {
    if (value !== undefined) {
      this.attribute.pushParam(keyOrParam as string, value)
    } else {
      this.attribute.pushParam(keyOrParam)
    }
    return this
  }

  public toString(): string {
    return '@@' + this.attribute.toString()
  }

  public static create(attribute: Function): BlockAttribute {
    return new BlockAttribute(attribute)
  }

  public getFunction(): Function {
    return this.attribute
  }
}