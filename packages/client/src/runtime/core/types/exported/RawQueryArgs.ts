import { RawValue, Sql } from '@prisma/client-runtime'

import { UnknownTypedSql } from './TypedSql'

export type RawQueryArgs = Sql | UnknownTypedSql | [query: string, ...values: RawValue[]]
