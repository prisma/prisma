import { Constant, Documentation, Function } from '../values'
import { FieldAttribute } from './attributes'
import { DefaultValue } from './default-value'
import { FieldType } from './field-type'

/**
 * A unique field attribute configuration.
 */
export class UniqueFieldAttribute {
  private _sortOrder?: string
  private _length?: number
  private _clustered?: boolean

  /**
   * Set the sort order for the unique constraint.
   */
  public sortOrder(order: 'Asc' | 'Desc'): this {
    this._sortOrder = order
    return this
  }

  /**
   * Set the length for the unique constraint.
   */
  public length(length: number): this {
    this._length = length
    return this
  }

  /**
   * Set whether the unique constraint is clustered.
   */
  public clustered(clustered: boolean): this {
    this._clustered = clustered
    return this
  }

  public toString(): string {
    const parts: string[] = ['@unique']
    const params: string[] = []

    if (this._sortOrder) {
      params.push(`sort: ${this._sortOrder}`)
    }
    if (this._length !== undefined) {
      params.push(`length: ${this._length}`)
    }
    if (this._clustered !== undefined) {
      params.push(`clustered: ${this._clustered}`)
    }

    if (params.length > 0) {
      parts[0] += `(${params.join(', ')})`
    }

    return parts.join(' ')
  }

  public static create(): UniqueFieldAttribute {
    return new UniqueFieldAttribute()
  }
}

/**
 * An ID field definition configuration.
 */
export class IdFieldDefinition {
  private _sortOrder?: string
  private _length?: number
  private _clustered?: boolean

  /**
   * Set the sort order for the ID field.
   */
  public sortOrder(order: 'Asc' | 'Desc'): this {
    this._sortOrder = order
    return this
  }

  /**
   * Set the length for the ID field.
   */
  public length(length: number): this {
    this._length = length
    return this
  }

  /**
   * Set whether the ID field is clustered.
   */
  public clustered(clustered: boolean): this {
    this._clustered = clustered
    return this
  }

  public toString(): string {
    const parts: string[] = ['@id']
    const params: string[] = []

    if (this._sortOrder) {
      params.push(`sort: ${this._sortOrder}`)
    }
    if (this._length !== undefined) {
      params.push(`length: ${this._length}`)
    }
    if (this._clustered !== undefined) {
      params.push(`clustered: ${this._clustered}`)
    }

    if (params.length > 0) {
      parts[0] += `(${params.join(', ')})`
    }

    return parts.join(' ')
  }

  public static create(): IdFieldDefinition {
    return new IdFieldDefinition()
  }
}

/**
 * A relation field configuration.
 */
export class Relation {
  private attribute: FieldAttribute

  constructor() {
    this.attribute = FieldAttribute.create(Function.create('relation'))
  }

  /**
   * Defines the relation name. The attribute will be value-only.
   */
  public name(name: string): this {
    this.attribute.pushParam(name)
    return this
  }

  /**
   * Defines the `ON DELETE` referential action.
   */
  public onDelete(action: string): this {
    this.attribute.pushParam('onDelete', action)
    return this
  }

  /**
   * Defines the `ON UPDATE` referential action.
   */
  public onUpdate(action: string): this {
    this.attribute.pushParam('onUpdate', action)
    return this
  }

  /**
   * Defines the local field names to the foreign key.
   */
  public fields(fields: string[]): this {
    // Create array of field names
    const fieldArray = `[${fields.join(', ')}]`
    this.attribute.pushParam('fields', fieldArray)
    return this
  }

  /**
   * Defines the foreign field names of the foreign key.
   */
  public references(references: string[]): this {
    // Create array of reference names
    const refArray = `[${references.join(', ')}]`
    this.attribute.pushParam('references', refArray)
    return this
  }

  public toString(): string {
    return this.attribute.toString()
  }

  public static create(): Relation {
    return new Relation()
  }
}

/**
 * A field in a model block.
 * Equivalent to Rust's Field<'a> struct.
 */
export class Field {
  private name: Constant
  private commentedOut = false
  private fieldType: FieldType
  private _documentation?: Documentation
  private _updatedAt?: FieldAttribute
  private unique?: UniqueFieldAttribute
  private id?: IdFieldDefinition
  private defaultValue?: DefaultValue
  private _map?: FieldAttribute
  private relation?: Relation
  private _nativeType?: FieldAttribute
  private ignore?: FieldAttribute

  /**
   * Create a new required model field declaration.
   */
  constructor(name: string, typeName: string) {
    this.name = Constant.create(name)
    this.fieldType = FieldType.required(typeName)
  }

  /**
   * Sets the field as optional.
   */
  public optional(): this {
    this.fieldType.intoOptional()
    return this
  }

  /**
   * Sets the field to be an array.
   */
  public array(): this {
    this.fieldType.intoArray()
    return this
  }

  /**
   * Sets the field to be unsupported.
   */
  public unsupported(): this {
    this.fieldType.intoUnsupported()
    return this
  }

  /**
   * Sets the field map attribute.
   */
  public map(value: string): this {
    const mapFunc = Function.create('map')
    mapFunc.pushParam(value)
    this._map = FieldAttribute.create(mapFunc)
    return this
  }

  /**
   * Documentation of the field.
   */
  public documentation(docs: string): this {
    if (this._documentation) {
      this._documentation.push(docs)
    } else {
      this._documentation = Documentation.create(docs)
    }
    return this
  }

  /**
   * Sets the field default attribute.
   */
  public default(value: DefaultValue): this {
    this.defaultValue = value
    return this
  }

  /**
   * Sets the native type of the field.
   */
  public nativeType(prefix: string, typeName: string, params: string[] = []): this {
    const nativeTypeFunc = Function.create(typeName)
    for (const param of params) {
      nativeTypeFunc.pushParam(param)
    }

    this._nativeType = FieldAttribute.create(nativeTypeFunc)
    this._nativeType.setPrefix(prefix)
    return this
  }

  /**
   * Marks the field to hold the update timestamp.
   */
  public updatedAt(): this {
    this._updatedAt = FieldAttribute.create(Function.create('updatedAt'))
    return this
  }

  /**
   * Marks the field to hold a unique constraint.
   */
  public uniqueConstraint(options: UniqueFieldAttribute): this {
    this.unique = options
    return this
  }

  /**
   * Marks the field to be the id of the model.
   */
  public idField(definition: IdFieldDefinition): this {
    this.id = definition
    return this
  }

  /**
   * Set the field to be a relation.
   */
  public relationField(relation: Relation): this {
    this.relation = relation
    return this
  }

  /**
   * Ignores the field.
   */
  public ignoreField(): this {
    this.ignore = FieldAttribute.create(Function.create('ignore'))
    return this
  }

  /**
   * Comments the field out.
   */
  public commentedOutField(): this {
    this.commentedOut = true
    return this
  }

  public toString(): string {
    let result = ''

    if (this.documentation) {
      result += this.documentation.toString()
    }

    if (this.commentedOut) {
      result += '// '
    }

    result += `${this.name.toString()} ${this.fieldType.toString()}`

    if (this.updatedAt) {
      result += ` ${this.updatedAt.toString()}`
    }

    if (this.unique) {
      result += ` ${this.unique.toString()}`
    }

    if (this.id) {
      result += ` ${this.id.toString()}`
    }

    if (this.defaultValue) {
      result += ` ${this.defaultValue.toString()}`
    }

    if (this.map) {
      result += ` ${this.map.toString()}`
    }

    if (this.relation) {
      result += ` ${this.relation.toString()}`
    }

    if (this.nativeType) {
      result += ` ${this.nativeType.toString()}`
    }

    if (this.ignore) {
      result += ` ${this.ignore.toString()}`
    }

    return result
  }

  public static create(name: string, typeName: string): Field {
    return new Field(name, typeName)
  }

  public getName(): string {
    return this.name.toString()
  }

  public getType(): FieldType {
    return this.fieldType
  }
}
