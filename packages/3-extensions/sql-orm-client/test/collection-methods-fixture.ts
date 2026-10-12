import type { Expression } from '@internal/sql-relational-core/expression';
import type {
  CollectionMethodTools,
  ExecutionContext,
  SqlCollectionMethodContribution,
} from '@internal/sql-relational-core/query-lane-context';
import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import type { CollectionMethodKind } from '../src/collection-methods';
import type { Contract as NotesContract } from './fixtures/collection-methods/generated/contract';
import notesContractJson from './fixtures/collection-methods/generated/contract.json' with {
  type: 'json',
};
import { buildTestContextFromContract, getTestContract, type TestContract } from './helpers';

export type { NotesContract };

export type Tsquery = Expression<{ codecId: 'pg/tsquery@1'; nullable: false }>;

/** Stands in for the type half of the Postgres package's `postgres/fullText`, which this package cannot import. */
export interface TestFullTextMethod extends CollectionMethodKind {
  readonly match: { readonly type: 'fullText' };
  readonly parameters: readonly [query: Tsquery];
}

type TestTrigramParameters<Index> = readonly [
  column: keyof (Index & { readonly columns: object })['columns'],
  text: string,
];

/** The method of a test-only index type. Its parameters read the index's literal columns. */
export interface TestTrigramMethod extends CollectionMethodKind {
  readonly match: { readonly type: 'test/trigram' };
  readonly parameters: TestTrigramParameters<this['index']>;
}

declare module '../src/collection-methods' {
  interface CollectionMethodRegistry {
    readonly 'postgres/fullText': TestFullTextMethod;
    readonly 'test/trigram': TestTrigramMethod;
  }
}

type Orderable = { desc(): unknown };
type RawTag = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => {
  returns(spec: string): Orderable;
};

function call(tools: CollectionMethodTools, name: string, ...args: unknown[]): unknown {
  const fn = tools.fns[name] as unknown as (...args: unknown[]) => unknown;
  return fn(...args);
}

export const testTrigramMethod: SqlCollectionMethodContribution = {
  id: 'test/trigram',
  matches: (index) => index.type === 'test/trigram',
  method: (collection, indexName, ...args) => {
    const [column, text] = args as unknown as [string, string];
    const columnOf = (tools: CollectionMethodTools) => tools.indexes[indexName]?.columns[column];
    return collection
      .where((_model, tools) => call(tools, 'eq', columnOf(tools), text))
      .orderBy((_model, tools) => {
        const raw = tools.fns['raw'] as unknown as RawTag;
        return raw`similarity(${columnOf(tools)}, ${text})`.returns('pg/float4@1').desc();
      });
  },
};

/** The run-time half of the test-only pack that owns `test/trigram`. */
export const trigramExtension: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension',
  id: 'test-trigram',
  version: '0.0.1',
  familyId: 'sql',
  targetId: 'postgres',
  codecs: () => [],
  collectionMethods: () => [testTrigramMethod],
  create: () => ({ familyId: 'sql', targetId: 'postgres' }),
};

export function notesContract(): NotesContract {
  return new PostgresContractSerializer().deserializeContract<NotesContract>(notesContractJson);
}

export function notesContext(): ExecutionContext<NotesContract> {
  return buildTestContextFromContract(notesContract(), { extensions: [trigramExtension] });
}

/** The test contract, which lists no pack that owns `test/trigram`, with that pack registered. */
export function contextWithTrigram(): ExecutionContext<TestContract> {
  return buildTestContextFromContract(getTestContract(), { extensions: [trigramExtension] });
}
