// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mappings
  }

  export interface Mappings {
    modelOperations: ModelMapping[]
    otherOperations: {
      read: string[]
      write: string[]
    }
  }

  export interface OtherOperationMappings {
    read: string[]
    write: string[]
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
  }

  export interface EnumValue {
    name: string
    dbName: string | null
  }

  export interface Datamodel {
    models: Model[]
    enums: DatamodelEnum[]
    types: Model[]
  }

  export interface uniqueIndex {
    name: string
    fields: string[]
  }
  export interface PrimaryKey {
    name: string | null
    fields: string[]
  }
  export interface Model {
    name: string
    dbName: string | null
    fields: Field[]
    uniqueFields: string[][]
    uniqueIndexes: uniqueIndex[]
    documentation?: string
    primaryKey: PrimaryKey | null
    [key: string]: any // safe net for additional new props // TODO: remove this and the others, not safe
  }

  export type FieldKind = 'scalar' | 'object' | 'enum' | 'unsupported'

  export type FieldNamespace = 'model' | 'prisma'
  export type FieldLocation = 'scalar' | 'inputObjectTypes' | 'outputObjectTypes' | 'enumTypes' | 'fieldRefTypes'

  export interface Field {
    kind: FieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    isReadOnly: boolean
    isGenerated?: boolean // does not exist on 'type' but does on 'model'
    isUpdatedAt?: boolean // does not exist on 'type' but does on 'model'
    /**
     * Describes the data type in the same the way is is defined in the Prisma schema:
     * BigInt, Boolean, Bytes, DateTime, Decimal, Float, Int, JSON, String, $ModelName
     */
    type: string
    dbNames?: string[] | null
    hasDefaultValue: boolean
    default?: FieldDefault | FieldDefaultScalar | FieldDefaultScalar[]
    relationFromFields?: string[]
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

  export type FieldDefaultScalar = string | boolean | number

  export interface Schema {
    rootQueryType?: string
    rootMutationType?: string
    inputObjectTypes: {
      // For now there are no `model` InputTypes
      model?: InputType[]
      prisma: InputType[]
    }
    outputObjectTypes: {
      model: OutputType[]
      prisma: OutputType[]
    }
    enumTypes: {
      model?: SchemaEnum[]
      prisma: SchemaEnum[]
    }
    fieldRefTypes: {
      // model?: FieldRefType[]
      prisma?: FieldRefType[]
    }
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

  export type ArgType = string | InputType | SchemaEnum

  export interface SchemaArgInputType {
    isList: boolean
    type: ArgType
    location: FieldLocation
    namespace?: FieldNamespace
  }

  export interface SchemaArg {
    name: string
    comment?: string
    isNullable: boolean
    isRequired: boolean
    inputTypes: SchemaArgInputType[]
    deprecation?: Deprecation
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
    fieldMap?: Record<string, SchemaField>
  }

  export interface SchemaField {
    name: string
    isNullable?: boolean
    outputType: OutputTypeRef
    args: SchemaArg[]
    deprecation?: Deprecation
    documentation?: string
  }

  export type TypeRefCommon = {
    isList: boolean
    namespace?: FieldNamespace
  }

  export type TypeRefScalar = TypeRefCommon & {
    location: 'scalar'
    type: string
  }

  export type TypeRefOutputObject = TypeRefCommon & {
    location: 'outputObjectTypes'
    type: OutputType | string
  }

  export type TypeRefEnum = TypeRefCommon & {
    location: 'enumTypes'
    type: SchemaEnum | string
  }

  export type OutputTypeRef = TypeRefScalar | TypeRefOutputObject | TypeRefEnum

  export interface Deprecation {
    sinceVersion: string
    reason: string
    plannedRemovalVersion?: string
  }

  export interface InputType {
    name: string
    constraints: {
      maxNumFields: number | null
      minNumFields: number | null
    }
    meta?: {
      source?: string
    }
    fields: SchemaArg[]
    fieldMap?: Record<string, SchemaArg>
  }

  export interface FieldRefType {
    name: string
    allowTypes: FieldRefAllowType[]
    fields: SchemaArg[]
  }

  export type FieldRefAllowType = TypeRefScalar | TypeRefEnum

  export interface ModelMapping {
    model: string
    plural: string
    findUnique?: string | null
    findFirst?: string | null
    findMany?: string | null
    create?: string | null
    createMany?: string | null
    update?: string | null
    updateMany?: string | null
    upsert?: string | null
    delete?: string | null
    deleteMany?: string | null
    aggregate?: string | null
    groupBy?: string | null
    count?: string | null
    findRaw?: string | null
    aggregateRaw?: string | null
  }

  export enum ModelAction {
    findUnique = 'findUnique',
    findFirst = 'findFirst',
    findMany = 'findMany',
    create = 'create',
    createMany = 'createMany',
    update = 'update',
    updateMany = 'updateMany',
    upsert = 'upsert',
    delete = 'delete',
    deleteMany = 'deleteMany',
    groupBy = 'groupBy',
    count = 'count', // TODO: count does not actually exist, why?
    aggregate = 'aggregate',
    findRaw = 'findRaw',
    aggregateRaw = 'aggregateRaw',
  }
}
