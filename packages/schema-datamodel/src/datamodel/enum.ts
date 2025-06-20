import { Constant, Documentation, Function } from '../values'
import { BlockAttribute, FieldAttribute } from './attributes'

/**
 * A variant declaration in an enum block.
 */
export class EnumVariant {
  private name: string
  private commentOut = false
  private map?: FieldAttribute
  private _documentation?: Documentation

  constructor(name: string) {
    this.name = name
  }

  /**
   * The map attribute of the variant.
   */
  public mapVariant(value: string): this {
    const func = Function.create('map')
    func.pushParam(value)
    this.map = FieldAttribute.create(func)
    return this
  }

  /**
   * Comments the variant out in the declaration.
   */
  public commentOutVariant(): this {
    this.commentOut = true
    return this
  }

  /**
   * Documentation of a variant.
   */
  public documentation(documentation: string): this {
    this._documentation = Documentation.create(documentation)
    return this
  }

  public toString(): string {
    let result = ''

    if (this._documentation) {
      result += this._documentation.toString()
    }

    if (this.commentOut) {
      result += '// '
    }

    result += this.name

    if (this.map) {
      result += ` ${this.map.toString()}`
    }

    return result
  }

  public static create(name: string): EnumVariant {
    return new EnumVariant(name)
  }

  public getName(): string {
    return this.name
  }
}

/**
 * An enum block in a PSL file.
 * Equivalent to Rust's Enum<'a> struct.
 */
export class Enum {
  private name: Constant
  private _documentation?: Documentation
  private variants: EnumVariant[] = []
  private map?: BlockAttribute
  private schema?: BlockAttribute

  constructor(name: string) {
    this.name = Constant.create(name)
  }

  /**
   * The documentation on top of the enum declaration.
   */
  public documentation(documentation: string): this {
    this._documentation = Documentation.create(documentation)
    return this
  }

  /**
   * The schema attribute of the enum block.
   */
  public schemaAttribute(schema: string): this {
    const func = Function.create('schema')
    func.pushParam(schema)
    this.schema = BlockAttribute.create(func)
    return this
  }

  /**
   * Add a new variant to the enum declaration.
   */
  public pushVariant(variant: EnumVariant | string): this {
    if (typeof variant === 'string') {
      this.variants.push(EnumVariant.create(variant))
    } else {
      this.variants.push(variant)
    }
    return this
  }

  /**
   * Sets the block level map attribute.
   */
  public mapEnum(mappedName: string): this {
    const func = Function.create('map')
    func.pushParam(mappedName)
    this.map = BlockAttribute.create(func)
    return this
  }

  public toString(): string {
    let result = ''

    if (this.documentation) {
      result += this.documentation.toString()
    }

    result += `enum ${this.name.toString()} {\n`

    // Render variants
    for (const variant of this.variants) {
      const variantStr = variant.toString()
      const lines = variantStr.split('\n')
      for (const line of lines) {
        if (line.trim()) {
          result += `  ${line}\n`
        } else {
          result += '\n'
        }
      }
    }

    // Render enum-level attributes
    if (this.map) {
      result += `  ${this.map.toString()}\n`
    }

    if (this.schema) {
      result += `  ${this.schema.toString()}\n`
    }

    result += '}\n'

    return result
  }

  public static create(name: string): Enum {
    return new Enum(name)
  }

  public getName(): string {
    return this.name.toString()
  }

  public getVariants(): readonly EnumVariant[] {
    return this.variants
  }
}