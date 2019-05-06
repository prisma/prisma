export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mapping[]
  }

  export interface Datamodel {
    models: Model[]
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    isEnum: boolean
    dbName: string
    fields: Field[]
  }

  export type FieldKind = 'scalar' | 'relation'

  export interface Field {
    kind: FieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    type: string
  }

  export interface Schema {
    queries: Query[]
    mutations: Query[]
    inputTypes: InputType[]
    outputTypes: OutputType[]
  }

  export interface Query {
    name: string
    args: SchemaArg[]
    output: QueryOutput
  }

  export interface QueryOutput {
    name: string
    isRequired: boolean
    isList: boolean
  }

  export interface SchemaArg {
    name: string
    type: string | InputType
    isScalar: boolean
    isRequired: boolean
    isList: boolean
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
  }

  export interface MergedOutputType extends OutputType {
    isEmbedded: boolean
    isEnum: boolean
    fields: SchemaField[]
  }

  export interface SchemaField {
    name: string
    type: string | MergedOutputType // note that in the serialized state we don't have the reference to MergedOutputTypes
    isList: boolean
    isRequired: boolean
    isScalar: boolean
    args: SchemaArg[]
  }

  export interface InputType {
    name: string
    args: SchemaArg[]
  }

  export interface Mapping {
    model: string
    findOne: string
    findMany: string
    create: string
    update: string
    updateMany: string
    upsert: string
    delete: string
    deleteMany: string
  }
}
