/**
 * A reference to a specific field of a specific model
 */
export type FieldRef<Model, FieldType> = {
  readonly modelName: Model
  readonly name: string
  readonly typeName: FieldType
  readonly isList: boolean
}
