import type {
  IndexReference,
  UniqueIndexNamesOfType,
} from '@internal/sql-relational-core/index-reference';
import type {
  CollectionMethodBody,
  CollectionMethodContribution,
  CollectionMethodModel,
  CollectionMethodRegistry,
  CollectionMethodsEntry,
  CollectionMethodTools,
} from '@internal/sql-relational-core/query-lane-context';
import { blindCast } from '@internal/utils/casts';
import type { TsqueryArgument } from '../types/operation-types';
import type { ExtractedCodecTypes, Resolve } from './codec-type-map';
import { FULL_TEXT_INDEX_TYPE } from './full-text-index-definition';

/** A `tsquery` expression from a parser or the `tsquery` tag, or a `tsquery` value read back from a query. */
export type PostgresTsqueryArgument = TsqueryArgument<Resolve<ExtractedCodecTypes>>;

type FullTextMethodTable<Model extends CollectionMethodModel> = Model['target'] extends 'postgres'
  ? {
      readonly [Name in UniqueIndexNamesOfType<
        Model['table']['indexes'][number],
        typeof FULL_TEXT_INDEX_TYPE
      >]: readonly [query: PostgresTsqueryArgument];
    }
  : Record<never, never>;

/** One method for each full-text index of a Postgres model, named after the index: `using.<index>(query)` filters to the rows that match `query`, most relevant first. */
export interface PostgresFullTextMethods extends CollectionMethodsEntry {
  readonly methods: FullTextMethodTable<this['model']>;
}

declare module '@internal/sql-relational-core/query-lane-context' {
  interface CollectionMethodRegistry {
    readonly 'postgres/fullText': PostgresFullTextMethods;
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

function fullTextMethod(indexName: string): CollectionMethodBody {
  return (collection, ...args) =>
    collection
      .where((_model, tools) =>
        indexFunction(tools, 'fullTextMatches')(tools.indexes[indexName], ...args),
      )
      .orderBy((_model, tools) =>
        indexFunction(tools, 'fullTextRank')(tools.indexes[indexName], ...args).desc(),
      );
}

/** The run-time half of `PostgresFullTextMethods`. */
export const postgresFullTextMethods: CollectionMethodContribution = {
  id: 'postgres/fullText' satisfies keyof CollectionMethodRegistry,
  methodsFor: (model) => {
    if (model.target !== 'postgres') return {};
    const names = model.table.indexes.map((index) => index.prefix ?? index.name);
    return Object.fromEntries(
      model.table.indexes.flatMap((index) => {
        const name = index.prefix ?? index.name;
        const unique = names.indexOf(name) === names.lastIndexOf(name);
        return index.type === FULL_TEXT_INDEX_TYPE && name !== undefined && unique
          ? [[name, fullTextMethod(name)]]
          : [];
      }),
    );
  },
};
