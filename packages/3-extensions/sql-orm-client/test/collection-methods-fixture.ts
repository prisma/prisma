import type {
  CollectionMethodContribution,
  CollectionMethodSignature,
  CollectionMethodTools,
  ExecutionContext,
} from '@internal/sql-relational-core/query-lane-context';
import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import type { Contract as NotesContract } from './fixtures/collection-methods/generated/contract';
import notesContractJson from './fixtures/collection-methods/generated/contract.json' with {
  type: 'json',
};
import { buildTestContextFromContract, getTestContract, type TestContract } from './helpers';

export type { NotesContract };

type TestTrigramParameters<Index> = readonly [
  column: keyof (Index & { readonly columns: object })['columns'],
  text: string,
];

/** The method of a test-only index type. Its parameters read the index's literal columns. */
export interface TestTrigramMethod extends CollectionMethodSignature {
  readonly match: { readonly type: 'test/trigram' };
  readonly parameters: TestTrigramParameters<this['index']>;
}

/** A method for `fullText` indexes that another target would own. A Postgres contract never gets it. */
export interface OtherTargetFullTextMethod extends CollectionMethodSignature {
  readonly target: 'test-other-target';
  readonly match: { readonly type: 'fullText' };
  readonly parameters: readonly [limit: number];
}

declare module '@internal/sql-relational-core/query-lane-context' {
  interface CollectionMethodRegistry {
    readonly 'test/trigram': TestTrigramMethod;
    readonly 'test/other-target-full-text': OtherTargetFullTextMethod;
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

export const testTrigramMethod: CollectionMethodContribution = {
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

export const otherTargetFullTextMethod: CollectionMethodContribution = {
  id: 'test/other-target-full-text',
  target: 'test-other-target',
  matches: (index) => index.type === 'fullText',
  method: (collection) => collection,
};

/** The run-time half of the test-only pack that owns `test/trigram`, and of the other target's method. */
export const trigramExtension: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension',
  id: 'test-trigram',
  version: '0.0.1',
  familyId: 'sql',
  targetId: 'postgres',
  codecs: () => [],
  collectionMethods: () => [testTrigramMethod, otherTargetFullTextMethod],
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
