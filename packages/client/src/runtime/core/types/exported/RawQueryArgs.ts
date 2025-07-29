import { RawValue, Sql } from 'sql-template-tag'

import { UnknownTypedSql } from './TypedSql'

export type RawQueryArgs = Sql | UnknownTypedSql | [query: string, ...values: RawValue[]]
