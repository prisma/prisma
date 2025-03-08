import type { RawValue, Sql } from 'sql-template-tag'

import type { UnknownTypedSql } from './TypedSql'

export type RawQueryArgs = Sql | UnknownTypedSql | [query: string, ...values: RawValue[]]
