import { Function, Value } from '../values'
import { FieldAttribute } from './attributes'

/**
 * A field default value.
 */
export class DefaultValue {
  constructor(private readonly attribute: FieldAttribute) {}

  /**
   * A function default value.
   *
   * Example:
   * ```
   * model Foo {
   *   field String @default(uuid())
   *                         ^^^^ this
   * }
   * ```
   */
  public static function(func: Function): DefaultValue {
    // Our specialty in default values, empty function params lead to
    // parentheses getting rendered unlike elsewhere.
    func.setRenderEmptyParentheses(true)

    const defaultFunc = Function.create('default')
    defaultFunc.pushParam(Value.function(func))

    return new DefaultValue(FieldAttribute.create(defaultFunc))
  }

  /**
   * A textual default value.
   *
   * Example:
   * ```
   * model Foo {
   *   field String @default("meow")
   *                          ^^^^ this
   * }
   * ```
   */
  public static text(value: string): DefaultValue {
    const defaultFunc = Function.create('default')
    defaultFunc.pushParam(Value.text(value))

    return new DefaultValue(FieldAttribute.create(defaultFunc))
  }

  /**
   * A byte array default value, base64-encoded.
   *
   * Example:
   * ```
   * model Foo {
   *   field Bytes @default("deadbeef")
   *                        ^^^^^^^^ this (base64)
   * }
   * ```
   */
  public static bytes(value: Uint8Array): DefaultValue {
    const defaultFunc = Function.create('default')
    defaultFunc.pushParam(Value.bytes(value))

    return new DefaultValue(FieldAttribute.create(defaultFunc))
  }

  /**
   * A constant default value.
   *
   * Example:
   * ```
   * model Foo {
   *   field Int @default(666420)
   *                      ^^^^^^ this
   * }
   * ```
   */
  public static constant(value: string | number | boolean): DefaultValue {
    const defaultFunc = Function.create('default')
    defaultFunc.pushParam(Value.constant(value))

    return new DefaultValue(FieldAttribute.create(defaultFunc))
  }

  /**
   * An array default value.
   *
   * Example:
   * ```
   * model Foo {
   *   field Int[] @default([1,2,3])
   *                        ^^^^^^^ this
   * }
   * ```
   */
  public static array(values: (string | number | boolean)[]): DefaultValue {
    const defaultFunc = Function.create('default')
    const arrayOfValues = values.map((value) => Value.constant(value))
    defaultFunc.pushParam(Value.array(arrayOfValues))

    return new DefaultValue(FieldAttribute.create(defaultFunc))
  }

  /**
   * Sets the default map argument.
   *
   * Example:
   * ```
   * model Foo {
   *   field String @default("foo", map: "IDDQDIDKFA")
   *                                      ^^^^^^^^^^ this
   * }
   * ```
   */
  public map(mappedName: string): this {
    this.attribute.pushParam('map', mappedName)
    return this
  }

  public toString(): string {
    return this.attribute.toString()
  }

  public getAttribute(): FieldAttribute {
    return this.attribute
  }
}
