// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mapping[]
  }

  export interface EnumValue {
    name: string
    dbName: string
  }

  export interface DatamodelEnum {
    name: string
    values: EnumValue[]
    dbName?: string | null
    documentation?: string
  }

  export interface SchemaEnum {
    name: string
    values: string[]
    dbName?: string | null
  }

  export interface Datamodel {
    models: Model[]
    enums: DatamodelEnum[]
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
    isGenerated: boolean
    documentation?: string
    uniqueFields: string[][]
    uniqueIndexes: uniqueIndex[]
    idFields: string[]
  }

  export type FieldKind = 'scalar' | 'object' | 'enum'
  export type DatamodelFieldKind = 'scalar' | 'relation' | 'enum'

  export interface Field {
    kind: DatamodelFieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isReadOnly: boolean
    isId: boolean
    isUpdatedAt: boolean
    type: string
    dbNames: string[] | null
    isGenerated: boolean
    hasDefaultValue: boolean
    default?: FieldDefault | string | boolean | number
    relationToFields?: any[]
    relationFromFields?: any[]
    relationOnDelete?: string
    relationName?: string
    documentation?: string
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
    enums: SchemaEnum[]
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
      isNullable: boolean
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

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace JsonRPC {
  export type Request = {
    jsonrpc: '2.0'
    method: string
    params?: any
    id: number
  }

  export type Response = SuccessResponse | ErrorResponse

  export type SuccessResponse = {
    jsonrpc: '2.0'
    result: any
    id: number
  }

  export type ErrorResponse = {
    jsonrpc: '2.0'
    error: {
      code: number
      message: string
      data: any
    }
    id: number
  }
}

export type Dictionary<T> = { [key: string]: T }

export interface GeneratorConfig {
  name: string
  output: string | null
  isCustomOutput?: boolean
  provider: string
  config: Dictionary<string>
  binaryTargets: string[] // check if new commit is there
  previewFeatures: string[]
}

export interface EnvValue {
  fromEnvVar: null | string
  value: string
}

export type ConnectorType = 'mysql' | 'mongo' | 'sqlite' | 'postgresql'

export interface DataSource {
  name: string
  activeProvider: ConnectorType
  provider: ConnectorType[]
  url: EnvValue
  config: { [key: string]: string }
}

export type BinaryPaths = {
  migrationEngine?: { [binaryTarget: string]: string } // key: target, value: path
  queryEngine?: { [binaryTarget: string]: string }
  introspectionEngine?: { [binaryTarget: string]: string }
}

export type GeneratorOptions = {
  generator: GeneratorConfig
  otherGenerators: GeneratorConfig[]
  schemaPath: string
  dmmf: DMMF.Document
  datasources: DataSource[]
  datamodel: string
  binaryPaths?: BinaryPaths
  version: string // version hash
}

export type EngineType =
  | 'queryEngine'
  | 'migrationEngine'
  | 'introspectionEngine'
  | 'prismaFmt'

export type GeneratorManifest = {
  prettyName?: string
  defaultOutput?: string
  denylists?: {
    models?: string[]
    fields?: string[]
  }
  requiresGenerators?: string[]
  requiresEngines?: EngineType[]
  version?: string
}
