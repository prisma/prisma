// Wrapper script for modifying the type of sql-template-tag@4.1.0
// TODO: We should remove this file when we upgrade sql-template-tag to 5.0.3 or above.
// Note: The reason why we don't upgrade it now is that it publishes with ESM syntax.
// We can upgrade it when we get rid of the use of `getTestClient` in testing.
// See the below for more context:
// - https://github.com/prisma/prisma/pull/11506
// - https://github.com/prisma/prisma/pull/14589

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
