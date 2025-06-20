import { Constant, Documentation, Function } from '../values'
import { BlockAttribute } from './attributes'
import { Field } from './field'

/**
 * Index field input for model-level indexes.
 */
export interface IndexFieldInput {
  name: string
  sortOrder?: 'Asc' | 'Desc'
  length?: number
  ops?: string
}

/**
 * Index definition for models.
 */
export class IndexDefinition {
  private attribute: BlockAttribute

  constructor(type: 'index' | 'unique' | 'fulltext', fields: IndexFieldInput[]) {
    const func = Function.create(type)

    // Build the fields array parameter
    const fieldArray = this.buildFieldsArray(fields)
    func.pushParam(fieldArray)

    this.attribute = BlockAttribute.create(func)
  }

  private buildFieldsArray(fields: IndexFieldInput[]): string {
    const fieldStrings = fields.map(field => {
      const parts = [field.name]
      const options: string[] = []

      if (field.sortOrder) {
        options.push(`sort: ${field.sortOrder}`)
      }
      if (field.length !== undefined) {
        options.push(`length: ${field.length}`)
      }
      if (field.ops) {
        options.push(`ops: ${field.ops}`)
      }

      if (options.length > 0) {
        return `${field.name}(${options.join(', ')})`
      }
      return field.name
    })

    return `[${fieldStrings.join(', ')}]`
  }

  /**
   * A normal index, defined as `@@index`.
   */
  public static index(fields: IndexFieldInput[]): IndexDefinition {
    return new IndexDefinition('index', fields)
  }

  /**
   * A unique constraint, defined as `@@unique`.
   */
  public static unique(fields: IndexFieldInput[]): IndexDefinition {
    return new IndexDefinition('unique', fields)
  }

  /**
   * A fulltext index, defined as `@@fulltext`.
   */
  public static fulltext(fields: IndexFieldInput[]): IndexDefinition {
    return new IndexDefinition('fulltext', fields)
  }

  /**
   * The client name of the index.
   */
  public name(name: string): this {
    this.attribute.pushParam('name', name)
    return this
  }

  /**
   * The constraint name in the database.
   */
  public map(map: string): this {
    this.attribute.pushParam('map', map)
    return this
  }

  /**
   * Defines the clustered argument.
   */
  public clustered(clustered: boolean): this {
    this.attribute.pushParam('clustered', clustered)
    return this
  }

  /**
   * The index type argument.
   */
  public indexType(indexType: string): this {
    this.attribute.pushParam('type', indexType)
    return this
  }

  public toString(): string {
    return this.attribute.toString()
  }
}

/**
 * Model-level ID definition.
 */
export class IdDefinition {
  private attribute: BlockAttribute

  constructor(fields: IndexFieldInput[]) {
    const func = Function.create('id')

    // Build the fields array parameter
    const fieldStrings = fields.map(field => {
      const options: string[] = []

      if (field.sortOrder) {
        options.push(`sort: ${field.sortOrder}`)
      }
      if (field.length !== undefined) {
        options.push(`length: ${field.length}`)
      }

      if (options.length > 0) {
        return `${field.name}(${options.join(', ')})`
      }
      return field.name
    })

    func.pushParam(`[${fieldStrings.join(', ')}]`)
    this.attribute = BlockAttribute.create(func)
  }

  /**
   * The client name of the id.
   */
  public name(name: string): this {
    this.attribute.pushParam('name', name)
    return this
  }

  /**
   * The constraint name in the database.
   */
  public map(map: string): this {
    this.attribute.pushParam('map', map)
    return this
  }

  /**
   * Defines the clustered argument.
   */
  public clustered(clustered: boolean): this {
    this.attribute.pushParam('clustered', clustered)
    return this
  }

  public toString(): string {
    return this.attribute.toString()
  }

  public static create(fields: IndexFieldInput[]): IdDefinition {
    return new IdDefinition(fields)
  }
}

/**
 * Defines a model block.
 * Equivalent to Rust's Model<'a> struct.
 */
export class Model {
  private name: Constant
  private _documentation?: Documentation
  private commentedOut = false
  private ignore?: BlockAttribute
  private id?: IdDefinition
  private map?: BlockAttribute
  private fields: Field[] = []
  private indexes: IndexDefinition[] = []
  private schema?: BlockAttribute

  constructor(name: string) {
    this.name = Constant.create(name)
  }

  /**
   * Documentation of the model. If called repeatedly, adds the new docs to the end with a
   * newline. This method is also responsible for avoiding to add the same comment twice.
   */
  public documentation(newDocumentation: string): this {
    if (this._documentation) {
      // Check if this documentation already exists to avoid duplicates
      if (!this._documentation.getContent().includes(newDocumentation)) {
        this._documentation.push(newDocumentation)
      }
    } else {
      this._documentation = Documentation.create(newDocumentation)
    }
    return this
  }

  /**
   * Ignore the model.
   */
  public ignoreModel(): this {
    this.ignore = BlockAttribute.create(Function.create('ignore'))
    return this
  }

  /**
   * Add a model-level id definition.
   */
  public idDefinition(id: IdDefinition): this {
    this.id = id
    return this
  }

  /**
   * Add a model-level mapping.
   */
  public mapModel(map: string): this {
    const func = Function.create('map')
    func.pushParam(map)
    this.map = BlockAttribute.create(func)
    return this
  }

  /**
   * The schema attribute of the model block.
   */
  public schemaAttribute(schema: string): this {
    const func = Function.create('schema')
    func.pushParam(schema)
    this.schema = BlockAttribute.create(func)
    return this
  }

  /**
   * Comments the complete model block out.
   */
  public commentOut(): this {
    this.commentedOut = true
    return this
  }

  /**
   * Push a new field to the end of the model.
   */
  public pushField(field: Field): this {
    this.fields.push(field)
    return this
  }

  /**
   * Push a new field to the beginning of the model.
   * Extremely inefficient, prefer `pushField` if you can.
   */
  public insertFieldFront(field: Field): this {
    this.fields.unshift(field)
    return this
  }

  /**
   * Push a new index to the model.
   */
  public pushIndex(index: IndexDefinition): this {
    this.indexes.push(index)
    return this
  }

  public toString(): string {
    let result = ''
    const comment = this.commentedOut ? '// ' : ''

    if (this.documentation) {
      result += this.documentation.toString()
    }

    result += `${comment}model ${this.name.toString()} {\n`

    // Render fields
    for (const field of this.fields) {
      const fieldStr = field.toString()
      if (this.commentedOut) {
        // Add comment prefix to each line
        const lines = fieldStr.split('\n')
        result += lines.map(line => line ? `${comment}${line}` : comment.trim()).join('\n') + '\n'
      } else {
        result += `  ${fieldStr}\n`
      }
    }

    // Render model-level attributes
    if (this.id) {
      result += `${comment}  ${this.id.toString()}\n`
    }

    for (const index of this.indexes) {
      result += `${comment}  ${index.toString()}\n`
    }

    if (this.map) {
      result += `${comment}  ${this.map.toString()}\n`
    }

    if (this.ignore) {
      result += `${comment}  ${this.ignore.toString()}\n`
    }

    if (this.schema) {
      result += `${comment}  ${this.schema.toString()}\n`
    }

    result += `${comment}}\n`

    return result
  }

  public static create(name: string): Model {
    return new Model(name)
  }

  public getName(): string {
    return this.name.toString()
  }

  public getFields(): readonly Field[] {
    return this.fields
  }

  public getIndexes(): readonly IndexDefinition[] {
    return this.indexes
  }
}