import type { IndexReference } from '@internal/sql-relational-core/index-reference';
import type {
  CollectionMethodTools,
  SqlCollectionMethodContribution,
} from '@internal/sql-relational-core/query-lane-context';
import { blindCast } from '@internal/utils/casts';
import { FULL_TEXT_INDEX_TYPE } from './full-text-index-definition';

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

/** The collection method for a full-text index: filters to the rows that match the query, most relevant first. */
export const postgresFullTextMethod: SqlCollectionMethodContribution = {
  id: 'postgres/fullText',
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
