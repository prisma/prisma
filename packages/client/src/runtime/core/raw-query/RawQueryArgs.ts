import { RawValue, Sql } from 'sql-template-tag'

export type RawQueryArgs = [query: string | TemplateStringsArray | Sql, ...values: RawValue[]]
