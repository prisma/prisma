import type { CollectionMethodKind } from '@internal/sql-orm-client';
import type { CodecTypes } from '@internal/target-postgres/codec-types';
import type { TsqueryArgument } from '@internal/target-postgres/operation-types';

/** The collection method of a full-text index: `using.<index>(query)` filters to the rows that match `query`, most relevant first. */
export interface PostgresFullTextMethod extends CollectionMethodKind {
  readonly match: { readonly type: 'fullText' };
  readonly parameters: readonly [query: TsqueryArgument<CodecTypes>];
}

declare module '@internal/sql-orm-client' {
  interface CollectionMethodRegistry {
    readonly 'postgres/fullText': PostgresFullTextMethod;
  }
}
