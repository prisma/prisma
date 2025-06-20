import { Constant, Documentation, Function } from '../values'
import { BlockAttribute } from './attributes'
import { Field } from './field'

/**
 * Defines a view block.
 * Similar to Model but for database views.
 */
export class View {
  private name: Constant
  private _documentation?: Documentation
  private fields: Field[] = []
  private map?: BlockAttribute
  private schema?: BlockAttribute

  constructor(name: string) {
    this.name = Constant.create(name)
  }

  /**
   * Documentation of the view.
   */
  public documentation(documentation: string): this {
    this._documentation = Documentation.create(documentation)
    return this
  }

  /**
   * Add a view-level mapping.
   */
  public mapView(map: string): this {
    const func = Function.create('map')
    func.pushParam(map)
    this.map = BlockAttribute.create(func)
    return this
  }

  /**
   * The schema attribute of the view block.
   */
  public schemaAttribute(schema: string): this {
    const func = Function.create('schema')
    func.pushParam(schema)
    this.schema = BlockAttribute.create(func)
    return this
  }

  /**
   * Push a new field to the end of the view.
   */
  public pushField(field: Field): this {
    this.fields.push(field)
    return this
  }

  /**
   * Push a new field to the beginning of the view.
   */
  public insertFieldFront(field: Field): this {
    this.fields.unshift(field)
    return this
  }

  public toString(): string {
    let result = ''

    if (this._documentation) {
      result += this._documentation.toString()
    }

    result += `view ${this.name.toString()} {\n`

    // Render fields
    for (const field of this.fields) {
      result += `  ${field.toString()}\n`
    }

    // Render view-level attributes
    if (this.map) {
      result += `  ${this.map.toString()}\n`
    }

    if (this.schema) {
      result += `  ${this.schema.toString()}\n`
    }

    result += '}\n'

    return result
  }

  public static create(name: string): View {
    return new View(name)
  }

  public getName(): string {
    return this.name.toString()
  }

  public getFields(): readonly Field[] {
    return this.fields
  }
}