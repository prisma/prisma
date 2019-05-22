export namespace DMMF {
  export interface Document<T extends BaseSchemaArg = SchemaArg> {
    datamodel: Datamodel
    schema: Schema<T>
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

  export interface Schema<T extends BaseSchemaArg = SchemaArg> {
    queries: Query<T>[]
    mutations: Query<T>[]
    inputTypes: InputType<T>[]
    outputTypes: OutputType<T>[]
    enums: Enum[]
  }

  export interface Query<T extends BaseSchemaArg = SchemaArg> {
    name: string
    args: T[]
    output: QueryOutput
  }

  export interface QueryOutput {
    name: string
    isRequired: boolean
    isList: boolean
  }

  export type ArgType<T extends BaseSchemaArg = SchemaArg> = string | InputType<T> | Enum

  export interface BaseSchemaArg {
    name: string
    type: ArgType | ArgType[]
    isScalar: boolean
    isRequired: boolean
    isEnum: boolean
    isList: boolean
  }

  export interface RawSchemaArg extends BaseSchemaArg {
    name: string
    type: ArgType
    isScalar: boolean
    isRequired: boolean
    isEnum: boolean
    isList: boolean
  }

  export interface SchemaArg extends BaseSchemaArg {
    name: string
    type: ArgType[]
    isScalar: boolean
    isRequired: boolean
    isEnum: boolean
    isList: boolean
  }

  export interface OutputType<T extends BaseSchemaArg = SchemaArg> {
    name: string
    fields: SchemaField<T>[]
  }

  export interface MergedOutputType<T extends BaseSchemaArg = SchemaArg> extends OutputType<T> {
    isEmbedded: boolean
    fields: SchemaField<T>[]
  }

  export interface SchemaField<T extends BaseSchemaArg = SchemaArg> {
    name: string
    type: string | MergedOutputType<T> | Enum // note that in the serialized state we don't have the reference to MergedOutputTypes
    isList: boolean
    isRequired: boolean
    kind: FieldKind
    args: T[]
  }

  export interface InputType<T extends BaseSchemaArg = SchemaArg> {
    name: string
    isWhereType?: boolean // this is needed to transform it back
    atLeastOne?: boolean
    atMostOne?: boolean
    args: T[]
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

export interface BaseField<T extends DMMF.BaseSchemaArg = DMMF.SchemaArg> {
  name: string
  type: string | DMMF.Enum | DMMF.MergedOutputType<T> | T['type']
  isList: boolean
  isRequired: boolean
}
