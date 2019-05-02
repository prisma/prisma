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
  export type Arity = 'required' | 'optional' | 'list'

  export interface Field {
    kind: FieldKind
    name: string
    arity: Arity
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
    arity: Arity
  }

  export interface SchemaArg {
    name: string
    type: string
    arity: Arity
  }

  export interface OutputType<T = string> {
    name: T
    fields: SchemaField[]
  }

  export interface SchemaField {
    name: string
    type: string
    arity: Arity
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
