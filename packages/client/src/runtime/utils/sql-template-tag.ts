// Wrapper script to work around the type bug of sql-template-tag@4.1.0

import { empty, join as joinOriginal, raw, Sql, sqltag as sqltagOriginal } from 'sql-template-tag'

declare function joinFunc(values: RawValue[], separator?: string): Sql
declare function sqltagFunc(strings: ReadonlyArray<string>, ...values: RawValue[]): Sql

const join = joinOriginal as typeof joinFunc
const sqltag = sqltagOriginal as typeof sqltagFunc

// back port the below fix to sql-template-tag@4.1.0
// https://github.com/blakeembrey/sql-template-tag/commit/9636d7db2020d357f1d41116388f838467439eec
type Value = unknown
type RawValue = Value | Sql
export type { RawValue, Value }
export { empty, join, raw, Sql, sqltag }
