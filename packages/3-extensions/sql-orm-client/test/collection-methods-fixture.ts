import type {
  CollectionMethodBody,
  CollectionMethodContribution,
  CollectionMethodContributionType,
  CollectionMethodModel,
  CollectionMethodModelType,
} from '@internal/sql-relational-core/collection-methods';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import type { Contract as NotesContract } from './fixtures/collection-methods/generated/contract';
import notesContractJson from './fixtures/collection-methods/generated/contract.json' with {
  type: 'json',
};
import { buildTestContextFromContract, getTestContract, type TestContract } from './helpers';

export type { NotesContract };

/** A test vector, typed with its length from the field's type parameters. */
export type TestVector<Length extends number> = number[] & { readonly length?: Length };

type FieldsOfCodec<Fields, CodecId extends string> = {
  [Name in keyof Fields]: Fields[Name] extends { readonly type: { readonly codecId: CodecId } }
    ? Name
    : never;
}[keyof Fields];

type LengthOf<Field> = Field extends {
  readonly type: { readonly typeParams: { readonly length: infer Length extends number } };
}
  ? Length
  : number;

type ClosestMethodTable<Fields> = {
  readonly [Name in FieldsOfCodec<Fields, 'pg/vector@1'> & string as `${Name}_closest`]: {
    readonly parameters: readonly [vector: TestVector<LengthOf<Fields[Name & keyof Fields]>>];
    readonly filters: false;
    readonly orders: true;
  };
};

/** One method per vector field, `<field>_closest(vector)`, with the vector typed from the field. It only orders. */
export interface TestClosestMethods extends CollectionMethodContributionType {
  readonly methods: ClosestMethodTable<this['model']['fields']>;
}

type HasColumnOfCodec<Model extends CollectionMethodModelType, CodecId extends string> = {
  [Column in keyof Model['table']['columns']]: Model['table']['columns'][Column] extends {
    readonly codecId: CodecId;
  }
    ? true
    : never;
}[keyof Model['table']['columns']];

/** `as_of(at)` on every model whose table has a `pg/jsonb@1` column; the name does not come from the schema. */
export interface TestAsOfMethods extends CollectionMethodContributionType {
  readonly methods: [HasColumnOfCodec<this['model'], 'pg/jsonb@1'>] extends [never]
    ? Record<never, never>
    : {
        readonly as_of: {
          readonly parameters: readonly [at: Date];
          readonly filters: false;
          readonly orders: true;
        };
      };
}

/** One half of a clashing pair: gives `Tag` a method `labelled`. */
export interface TestClashA extends CollectionMethodContributionType {
  readonly methods: this['model']['name'] extends 'Tag'
    ? {
        readonly labelled: {
          readonly parameters: readonly [label: string];
          readonly filters: false;
          readonly orders: false;
        };
      }
    : Record<never, never>;
}

/** The other half of the clashing pair: also gives `Tag` a method `labelled`. */
export interface TestClashB extends CollectionMethodContributionType {
  readonly methods: this['model']['name'] extends 'Tag'
    ? {
        readonly labelled: {
          readonly parameters: readonly [label: string, exact: boolean];
          readonly filters: false;
          readonly orders: false;
        };
      }
    : Record<never, never>;
}

declare module '@internal/sql-relational-core/collection-methods' {
  interface CollectionMethodRegistry {
    readonly 'test/closest': TestClosestMethods;
    readonly 'test/as-of': TestAsOfMethods;
    readonly 'test/clash-a': TestClashA;
    readonly 'test/clash-b': TestClashB;
  }
}

type Orderable = { asc(): unknown; desc(): unknown };

function fieldOf(model: unknown, name: string): Orderable {
  return Reflect.get(model as object, name) as Orderable;
}

function closest(_field: string): CollectionMethodBody {
  return (collection) => collection.orderBy((model) => fieldOf(model, 'id').asc());
}

export const testClosestMethods: CollectionMethodContribution = {
  id: 'test/closest',
  methodsFor: (model) =>
    Object.fromEntries(
      Object.entries(model.fields).flatMap(([name, field]) =>
        field.type.kind === 'scalar' && field.type.codecId === 'pg/vector@1'
          ? [[`${name}_closest`, closest(name)]]
          : [],
      ),
    ),
};

export const testAsOfMethods: CollectionMethodContribution = {
  id: 'test/as-of',
  methodsFor: (model) =>
    Object.values(model.table.columns).some((column) => column.codecId === 'pg/jsonb@1')
      ? { as_of: (collection) => collection.orderBy((row) => fieldOf(row, 'id').desc()) }
      : {},
};

function labelledFor(id: string): CollectionMethodContribution {
  return {
    id,
    methodsFor: (model: CollectionMethodModel) =>
      model.name === 'Tag' ? { labelled: (collection) => collection } : {},
  };
}

export const testClashA = labelledFor('test/clash-a');
export const testClashB = labelledFor('test/clash-b');

function extension(
  id: string,
  methods: ReadonlyArray<CollectionMethodContribution>,
): SqlRuntimeExtensionDescriptor<'postgres'> {
  return {
    kind: 'extension',
    id,
    version: '0.0.1',
    familyId: 'sql',
    targetId: 'postgres',
    codecs: () => [],
    collectionMethods: () => methods,
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  };
}

export const testMethodsExtension = extension('test-methods', [
  testClosestMethods,
  testAsOfMethods,
  testClashA,
]);

export function notesContract(): NotesContract {
  return new PostgresContractSerializer().deserializeContract<NotesContract>(notesContractJson);
}

export function notesContext(): ExecutionContext<NotesContract> {
  return buildTestContextFromContract(notesContract());
}

/** The test contract with the test contributions registered, without the second half of the clashing pair. */
export function contextWithTestMethods(): ExecutionContext<TestContract> {
  return buildTestContextFromContract(getTestContract(), { extensions: [testMethodsExtension] });
}

/** The test contract with both halves of the clashing pair registered. */
export function contextWithClash(): ExecutionContext<TestContract> {
  return buildTestContextFromContract(getTestContract(), {
    extensions: [testMethodsExtension, extension('test-clash-b', [testClashB])],
  });
}
