export type SqlQueryOutput = {
  name: string
  source: string
  documentation: string | null
  parameters: SqlQueryParameterOutput[]
  resultColumns: SqlQueryColumnOutput[]
}

export type SqlQueryParameterOutput = {
  name: string
  typ: QueryIntrospectionType
  documentation: string | null
  nullable: boolean
}

export type SqlQueryColumnOutput = {
  name: string
  typ: QueryIntrospectionType
  nullable: boolean
}

// can refer to user-defined enums, so does not map to QueryIntrospectionType 1:1
export type QueryIntrospectionType = QueryIntrospectionBuiltinType | (string & {})

// This must remain in sync with the `quaint::ColumnType` enum in the QueryEngine.
// ./quaint/src/connector/column_type.rs
export type QueryIntrospectionBuiltinType =
  | 'int'
  | 'bigint'
  | 'float'
  | 'double'
  | 'string'
  | 'enum'
  | 'bytes'
  | 'bool'
  | 'char'
  | 'decimal'
  | 'json'
  | 'xml'
  | 'uuid'
  | 'datetime'
  | 'date'
  | 'time'
  | 'int-array'
  | 'bigint-array'
  | 'float-array'
  | 'double-array'
  | 'string-array'
  | 'char-array'
  | 'bytes-array'
  | 'bool-array'
  | 'decimal-array'
  | 'json-array'
  | 'xml-array'
  | 'uuid-array'
  | 'datetime-array'
  | 'date-array'
  | 'time-array'
  | 'null'
  | 'unknown'
