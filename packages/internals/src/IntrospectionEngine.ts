export interface IntrospectionEngineOptions {
  binaryPath?: string
  debug?: boolean
  cwd?: string
}

export interface RPCPayload {
  id: number
  jsonrpc: string
  method: string
  params: any
}

export class IntrospectionPanic extends Error {
  public request: any
  public rustStack: string
  constructor(message: string, rustStack: string, request: any) {
    super(message)
    this.rustStack = rustStack
    this.request = request
  }
}

export class IntrospectionError extends Error {
  public code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

// See prisma-engines
// SQL https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/sql-introspection-connector/src/warnings.rs
// Mongo https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs
export type IntrospectionWarnings =
  | IntrospectionWarningsUnhandled
  | IntrospectionWarningsInvalidReintro
  | IntrospectionWarningsMissingUnique
  | IntrospectionWarningsEmptyFieldName
  | IntrospectionWarningsUnsupportedType
  | IntrospectionWarningsInvalidEnumName
  | IntrospectionWarningsCuidPrisma1
  | IntrospectionWarningsUuidPrisma1
  | IntrospectionWarningsFieldModelReintro
  | IntrospectionWarningsFieldMapReintro
  | IntrospectionWarningsEnumMapReintro
  | IntrospectionWarningsEnumValueMapReintro
  | IntrospectionWarningsCuidReintro
  | IntrospectionWarningsUuidReintro
  | IntrospectionWarningsUpdatedAtReintro
  | IntrospectionWarningsWithoutColumns
  | IntrospectionWarningsModelsWithIgnoreReintro
  | IntrospectionWarningsFieldsWithIgnoreReintro
  | IntrospectionWarningsCustomIndexNameReintro
  | IntrospectionWarningsCustomPrimaryKeyNamesReintro
  | IntrospectionWarningsRelationsReintro
  | IntrospectionWarningsTopLevelItemNameIsADupe
  // MongoDB below
  | IntrospectionWarningsMongoMultipleTypes
  | IntrospectionWarningsMongoFieldsPointingToAnEmptyType
  | IntrospectionWarningsMongoFieldsWithUnknownTypes
  | IntrospectionWarningsMongoFieldsWithEmptyNames

type AffectedTopLevel = { type: 'Model' | 'Enum'; name: string }
type AffectedModel = { model: string }
type AffectedModelAndIndex = { model: string; index_db_name: string }
type AffectedModelAndField = { model: string; field: string }
type AffectedModelAndFieldAndType = {
  model: string
  field: string
  tpe: string
}
type AffectedModelOrCompositeTypeAndField = {
  // Either compositeType or model is defined
  compositeType?: string
  model?: string
  field: string
}
type AffectedModelOrCompositeTypeAndFieldAndType = AffectedModelOrCompositeTypeAndField & {
  tpe: string
}
type AffectedEnum = { enm: string }
type AffectedEnumAndValue = { enm: string; value: string }

interface IntrospectionWarning {
  code: number
  message: string
  affected:
    | AffectedTopLevel[]
    | AffectedModel[]
    | AffectedModelAndIndex[]
    | AffectedModelAndField[]
    | AffectedModelAndFieldAndType[]
    | AffectedModelOrCompositeTypeAndField[]
    | AffectedModelOrCompositeTypeAndFieldAndType[]
    | AffectedEnum[]
    | AffectedEnumAndValue[]
    | null
}

interface IntrospectionWarningsUnhandled extends IntrospectionWarning {
  code: -1 // -1 doesn't exist, it's just for the types
  affected: any
}
interface IntrospectionWarningsInvalidReintro extends IntrospectionWarning {
  code: 0
  affected: null
}
interface IntrospectionWarningsMissingUnique extends IntrospectionWarning {
  code: 1
  affected: AffectedModel[]
}
interface IntrospectionWarningsEmptyFieldName extends IntrospectionWarning {
  code: 2
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUnsupportedType extends IntrospectionWarning {
  code: 3
  affected: AffectedModelAndFieldAndType[]
}
interface IntrospectionWarningsInvalidEnumName extends IntrospectionWarning {
  code: 4
  affected: AffectedEnumAndValue[]
}
interface IntrospectionWarningsCuidPrisma1 extends IntrospectionWarning {
  code: 5
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUuidPrisma1 extends IntrospectionWarning {
  code: 6
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsFieldModelReintro extends IntrospectionWarning {
  code: 7
  affected: AffectedModel[]
}
interface IntrospectionWarningsFieldMapReintro extends IntrospectionWarning {
  code: 8
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsEnumMapReintro extends IntrospectionWarning {
  code: 9
  affected: AffectedEnum[]
}
interface IntrospectionWarningsEnumValueMapReintro extends IntrospectionWarning {
  code: 10
  affected: AffectedEnum[]
}
interface IntrospectionWarningsCuidReintro extends IntrospectionWarning {
  code: 11
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUuidReintro extends IntrospectionWarning {
  code: 12
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsUpdatedAtReintro extends IntrospectionWarning {
  code: 13
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsWithoutColumns extends IntrospectionWarning {
  code: 14
  affected: AffectedModel[]
}
interface IntrospectionWarningsModelsWithIgnoreReintro extends IntrospectionWarning {
  code: 15
  affected: AffectedModel[]
}
interface IntrospectionWarningsFieldsWithIgnoreReintro extends IntrospectionWarning {
  code: 16
  affected: AffectedModelAndField[]
}
interface IntrospectionWarningsCustomIndexNameReintro extends IntrospectionWarning {
  code: 17
  affected: AffectedModelAndIndex[]
}
interface IntrospectionWarningsCustomPrimaryKeyNamesReintro extends IntrospectionWarning {
  code: 18
  affected: AffectedModel[]
}
interface IntrospectionWarningsRelationsReintro extends IntrospectionWarning {
  code: 19
  affected: AffectedModel[]
}
interface IntrospectionWarningsTopLevelItemNameIsADupe extends IntrospectionWarning {
  code: 20
  affected: AffectedTopLevel[]
}

// MongoDB starts at 101 see
// https://github.com/prisma/prisma-engines/blob/main/introspection-engine/connectors/mongodb-introspection-connector/src/warnings.rs#L39-L43
interface IntrospectionWarningsMongoMultipleTypes extends IntrospectionWarning {
  code: 101
  affected: AffectedModelOrCompositeTypeAndFieldAndType[]
}
interface IntrospectionWarningsMongoFieldsPointingToAnEmptyType extends IntrospectionWarning {
  code: 102
  affected: AffectedModelOrCompositeTypeAndField[]
}
interface IntrospectionWarningsMongoFieldsWithUnknownTypes extends IntrospectionWarning {
  code: 103
  affected: AffectedModelOrCompositeTypeAndField[]
}
interface IntrospectionWarningsMongoFieldsWithEmptyNames extends IntrospectionWarning {
  code: 104
  affected: AffectedModelOrCompositeTypeAndField[]
}

export type IntrospectionSchemaVersion = 'Prisma2' | 'Prisma1' | 'Prisma11' | 'NonPrisma'
