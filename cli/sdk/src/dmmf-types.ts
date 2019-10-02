export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mapping[]
  }

  export interface Enum {
    name: string
    values: string[]
    dbName?: string | null
  }

  export interface Datamodel {
    models: Model[]
    enums: Enum[]
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    dbName: string | null
    fields: Field[]
  }

  export type FieldKind = 'scalar' | 'object' | 'enum'
  export type DatamodelFieldKind = 'scalar' | 'relation' | 'enum'

  export interface Field {
    kind: DatamodelFieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    type: string
    dbName: string | null
    isGenerated: boolean
    relationToFields?: any[]
    relationOnDelete?: string
    relationName?: string
  }

  export interface Schema {
    rootQueryType?: string
    rootMutationType?: string
    inputTypes: InputType[]
    outputTypes: OutputType[]
    enums: Enum[]
  }

  export interface QueryOutput {
    name: string
    isRequired: boolean
    isList: boolean
  }

  export type ArgType = string

  export interface SchemaArg {
    name: string
    inputType: {
      isRequired: boolean
      isList: boolean
      type: ArgType
      kind: FieldKind
    }
    isRelationFilter?: boolean
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
    isEmbedded?: boolean
  }

  export interface SchemaField {
    name: string
    outputType: {
      type: string // note that in the serialized state we don't have the reference to MergedOutputTypes
      isList: boolean
      isRequired: boolean
      kind: FieldKind
    }
    args: SchemaArg[]
  }

  export interface InputType {
    name: string
    isWhereType?: boolean // this is needed to transform it back
    isOrderType?: boolean
    atLeastOne?: boolean
    atMostOne?: boolean
    fields: SchemaArg[]
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
