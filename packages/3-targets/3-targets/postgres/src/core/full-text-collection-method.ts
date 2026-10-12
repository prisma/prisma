import type { IndexReference } from '@internal/sql-relational-core/index-reference';
import type {
  CollectionMethodContribution,
  CollectionMethodRegistry,
  CollectionMethodSignature,
  CollectionMethodTools,
} from '@internal/sql-relational-core/query-lane-context';
import { blindCast } from '@internal/utils/casts';
import type { TsqueryArgument } from '../types/operation-types';
import type { ExtractedCodecTypes, Resolve } from './codec-type-map';
import { FULL_TEXT_INDEX_TYPE } from './full-text-index-definition';

/** A `tsquery` expression from a parser or the `tsquery` tag, or a `tsquery` value read back from a query. */
export type PostgresTsqueryArgument = TsqueryArgument<Resolve<ExtractedCodecTypes>>;

/** The collection method of a full-text index: `using.<index>(query)` filters to the rows that match `query`, most relevant first. */
export interface PostgresFullTextMethod extends CollectionMethodSignature {
  readonly target: 'postgres';
  readonly match: { readonly type: typeof FULL_TEXT_INDEX_TYPE };
  readonly parameters: readonly [query: PostgresTsqueryArgument];
}

declare module '@internal/sql-relational-core/query-lane-context' {
  interface CollectionMethodRegistry {
    readonly 'postgres/fullText': PostgresFullTextMethod;
  }
}

type IndexFunction = (index: IndexReference | undefined, ...args: never[]) => { desc(): unknown };

function indexFunction(
  tools: CollectionMethodTools,
  name: 'fullTextMatches' | 'fullTextRank',
): IndexFunction {
  return blindCast<
    IndexFunction,
    'this target registers fullTextMatches and fullTextRank, which take an index and a tsquery'
  >(tools.fns[name]);
}

/** The run-time half of `PostgresFullTextMethod`. */
export const postgresFullTextMethod: CollectionMethodContribution = {
  id: 'postgres/fullText' satisfies keyof CollectionMethodRegistry,
  target: 'postgres' satisfies PostgresFullTextMethod['target'],
  matches: (index) => index.type === FULL_TEXT_INDEX_TYPE,
  method: (collection, indexName, ...args) =>
    collection
      .where((_model, tools) =>
        indexFunction(tools, 'fullTextMatches')(tools.indexes[indexName], ...args),
      )
      .orderBy((_model, tools) =>
        indexFunction(tools, 'fullTextRank')(tools.indexes[indexName], ...args).desc(),
      ),
};
