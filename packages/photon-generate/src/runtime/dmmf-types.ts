export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mapping[]
  }

  export interface Enum {
    name: string
    values: string[]
  }

  export interface Datamodel {
    models: Model[]
    enums: Enum[]
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    dbName: string
    fields: Field[]
  }

  export type FieldKind = 'scalar' | 'relation' | 'enum'

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
    enums: Enum[]
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
    type: string | InputType | Enum
    isScalar: boolean
    isRequired: boolean
    isEnum: boolean
    isList: boolean
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
  }

  export interface MergedOutputType extends OutputType {
    isEmbedded: boolean
    fields: SchemaField[]
  }

  export interface SchemaField {
    name: string
    type: string | MergedOutputType | Enum // note that in the serialized state we don't have the reference to MergedOutputTypes
    isList: boolean
    isRequired: boolean
    kind: FieldKind
    args: SchemaArg[]
  }

  export interface InputType {
    name: string
    args: SchemaArg[]
  }

  export interface Mapping {
    model: string
    findOne?: string
    findMany?: string
    create?: string
    update?: string
    updateMany?: string
    upsert?: string
    delete?: string
    deleteMany?: string
  }

  export enum ModelAction {
    findOne = 'findOne',
    findMany = 'findMany',
    create = 'create',
    update = 'update',
    updateMany = 'updateMany',
    upsert = 'upsert',
    delete = 'delete',
    deleteMany = 'deleteMany',
  }
}

export interface BaseField {
  name: string
  type: string | DMMF.MergedOutputType | DMMF.InputType | DMMF.Enum
  isList: boolean
  isRequired: boolean
}
