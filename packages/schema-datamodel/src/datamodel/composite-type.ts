import { Constant, Documentation } from '../values'
import { Field } from './field'

/**
 * A type block in a PSL file.
 * Equivalent to Rust's CompositeType<'a> struct.
 */
export class CompositeType {
  private name: Constant
  private _documentation?: Documentation
  private fields: Field[] = []
  constructor(name: string) {
    this.name = Constant.create(name)
  }

  /**
   * Documentation of the type.
   */
  public documentation(documentation: string): this {
    this._documentation = Documentation.create(documentation)
    return this
  }

  /**
   * Add a new field to the type.
   */
  public pushField(field: Field): this {
    this.fields.push(field)
    return this
  }

  public toString(): string {
    let result = ''

    if (this.documentation) {
      result += this.documentation.toString()
    }

    result += `type ${this.name.toString()} {\n`

    // Render fields
    for (const field of this.fields) {
      result += `  ${field.toString()}\n`
    }

    result += '}\n'

    return result
  }

  public static create(name: string): CompositeType {
    return new CompositeType(name)
  }

  public getName(): string {
    return this.name.toString()
  }

  public getFields(): readonly Field[] {
    return this.fields
  }
}
