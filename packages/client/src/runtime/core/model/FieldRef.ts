/**
 * A reference to a specific field of a specific model
 */
export interface FieldRef<Model, FieldType> {
  readonly modelName: Model
  readonly name: string
  readonly typeName: FieldType
  readonly isList: boolean
  readonly isEnum: boolean
}

export class FieldRefImpl<Model, FieldType> implements FieldRef<Model, FieldType> {
  public readonly modelName: Model
  public readonly name: string
  public readonly typeName: FieldType
  public readonly isList: boolean
  public readonly isEnum: boolean

  constructor(modelName: Model, name: string, fieldType: FieldType, isList: boolean, isEnum: boolean) {
    this.modelName = modelName
    this.name = name
    this.typeName = fieldType
    this.isList = isList
    this.isEnum = isEnum
  }

  _toGraphQLInputType() {
    const listPrefix = this.isList ? `List` : ''
    const enumPrefix = this.isEnum ? 'Enum' : ''
    return `${listPrefix}${enumPrefix}${this.typeName}FieldRefInput<${this.modelName}>`
  }
}

export function isFieldRef(value: unknown): value is FieldRef<string, unknown> {
  return value instanceof FieldRefImpl
}
