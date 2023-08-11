import { RawValue, Sql } from 'sql-template-tag'

export type RawQueryArgs = Sql | [query: string, ...values: RawValue[]]
