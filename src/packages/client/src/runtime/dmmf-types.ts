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
    documentation?: string
  }

  export interface Datamodel {
    models: Model[]
    enums: Enum[]
  }

  export interface uniqueIndex {
    name: string
    fields: string[]
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    dbName: string | null
    fields: Field[]
    uniqueFields: string[][]
    uniqueIndexes: uniqueIndex[]
    documentation?: string
    idFields: string[]
    [key: string]: any // safe net for additional new props
  }

  export type FieldKind = 'scalar' | 'object' | 'enum'

  export interface Field {
    kind: FieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    type: string
    dbNames: string[] | null
    isGenerated: boolean
    hasDefaultValue: boolean
    default?: FieldDefault | string | boolean | number
    relationToFields?: any[]
    relationOnDelete?: string
    relationName?: string
    documentation?: string
    [key: string]: any // safe net for additional new props
  }

  export interface FieldDefault {
    name: string
    args: any[]
  }

  export interface Schema {
    rootQueryType?: string
    rootMutationType?: string
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

  export type ArgType = string | InputType | Enum

  export interface SchemaArgInputType {
    isRequired: boolean
    isNullable: boolean
    isList: boolean
    type: ArgType
    kind: FieldKind
  }

  export interface SchemaArg {
    name: string
    inputType: SchemaArgInputType[]
    isRelationFilter?: boolean
    nullEqualsUndefined?: boolean
    comment?: string
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
    fieldMap?: Record<string, SchemaField>
    isEmbedded?: boolean
  }

  export interface SchemaField {
    name: string
    outputType: {
      type: string | OutputType | Enum // note that in the serialized state we don't have the reference to MergedOutputTypes
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
    fieldMap?: Record<string, SchemaArg>
  }

  export interface Mapping {
    model: string
    plural: string
    findOne?: string | null
    findMany?: string | null
    create?: string | null
    update?: string | null
    updateMany?: string | null
    upsert?: string | null
    delete?: string | null
    deleteMany?: string | null
    aggregate?: string | null
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
  type: string | DMMF.Enum | DMMF.OutputType | DMMF.SchemaArg
  isList: boolean
  isRequired: boolean
}
