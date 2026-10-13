import type {
  ExtractAggregateTypes,
  ExtractCodecTypes,
  ExtractFieldInputTypes,
  ExtractFieldOutputTypes,
  ExtractQueryOperationTypes,
  ExtractStorageColumnInputTypes,
  ExtractStorageColumnTypes,
} from '@internal/sql-contract/types';
import { describe, expectTypeOf, test } from 'vitest';
import type { contract as postgresSource } from '../planner-golden/fixtures/postgres/contract';
import type { Contract as PostgresEmitted } from '../planner-golden/fixtures/postgres/generated/contract';
import type { contract as sqliteSource } from '../planner-golden/fixtures/sqlite/contract';
import type { Contract as SqliteEmitted } from '../planner-golden/fixtures/sqlite/generated/contract';
import type { contract as relationsSource } from '../sql-builder/fixtures/contract-no-pgvector';
import type { Contract as RelationsEmitted } from '../sql-builder/fixtures/generated-no-pgvector/contract';

type PostgresBuilt = typeof postgresSource;
type SqliteBuilt = typeof sqliteSource;
type RelationsBuilt = typeof relationsSource;

type SameType<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** The keys whose values differ between two maps, or that only one has; `never` when they agree. */
type DifferingKeys<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? SameType<A[K], B[K]> extends true
        ? never
        : K
      : K
    : K;
}[keyof A | keyof B];

/** `'<outer>.<inner>'` for each entry of a two-level map that differs; `never` when they agree. */
type DifferingPaths<A, B> = {
  [K in (keyof A | keyof B) & string]: K extends keyof A
    ? K extends keyof B
      ? `${K}.${DifferingKeys<A[K], B[K]> & string}`
      : K
    : K;
}[(keyof A | keyof B) & string];

type NamespaceMaps<Map> = Map[keyof Map];

type PublicCodecTypes<CodecTypes> = {
  readonly [CodecId in keyof CodecTypes]: Pick<
    CodecTypes[CodecId],
    Extract<keyof CodecTypes[CodecId], 'input' | 'output' | 'traits'>
  >;
};

type EnabledCapabilities<Contract extends { readonly capabilities: object }> = {
  readonly [Namespace in keyof Contract['capabilities'] & string]: {
    readonly [Flag in keyof Contract['capabilities'][Namespace] as Contract['capabilities'][Namespace][Flag] extends true
      ? Flag
      : never]: true;
  };
};

type ColumnsWithDefault<Contract extends { readonly storage: { readonly namespaces: object } }> = {
  readonly [Namespace in keyof Contract['storage']['namespaces']]: Contract['storage']['namespaces'][Namespace] extends {
    readonly entries: { readonly table: infer Tables };
  }
    ? {
        readonly [Table in keyof Tables]: Tables[Table] extends { readonly columns: infer Columns }
          ? {
              readonly [Column in keyof Columns]: Columns[Column] extends {
                readonly default: unknown;
              }
                ? true
                : false;
            }
          : never;
      }
    : never;
};

type ExecutionDefaultRefs<Contract extends { readonly execution?: unknown }> =
  NonNullable<Contract['execution']> extends {
    readonly mutations: { readonly defaults: ReadonlyArray<{ readonly ref: infer Ref }> };
  }
    ? Ref
    : never;

// The emitter writes a model without relations as `Record<string, never>`; the built contract gives `{}`.
type WithoutIndexSignature<Map> = string extends keyof Map ? Record<never, never> : Map;

type Relations<
  Contract extends { readonly domain: { readonly namespaces: object } },
  Namespace extends keyof Contract['domain']['namespaces'],
> = Contract['domain']['namespaces'][Namespace] extends {
  readonly models: infer Models;
}
  ? {
      readonly [Model in keyof Models]: Models[Model] extends { readonly relations: infer R }
        ? WithoutIndexSignature<R>
        : never;
    }
  : never;

// The full-text operations take a `FullTextIndexReference<CodecTypes>`; the built codec types leave out the emitted `json` slot, which no operation reads, so the interfaces' type arguments differ.
type ComparedQueryOperations<Operations> = Omit<Operations, 'fullTextMatches' | 'fullTextRank'>;

describe('the type maps of a contract written with defineContract equal the emitted ones', () => {
  test('codec types', () => {
    expectTypeOf<
      DifferingKeys<
        ExtractCodecTypes<PostgresBuilt>,
        PublicCodecTypes<ExtractCodecTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingKeys<
        ExtractCodecTypes<SqliteBuilt>,
        PublicCodecTypes<ExtractCodecTypes<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
  });

  test('query operation types', () => {
    expectTypeOf<
      DifferingKeys<
        ExtractQueryOperationTypes<PostgresBuilt>,
        ExtractQueryOperationTypes<PostgresEmitted>
      >
    >().toEqualTypeOf<'fullTextMatches' | 'fullTextRank'>();
    expectTypeOf<
      DifferingKeys<
        ComparedQueryOperations<ExtractQueryOperationTypes<PostgresBuilt>>,
        ComparedQueryOperations<ExtractQueryOperationTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<keyof ExtractQueryOperationTypes<SqliteBuilt>>().toEqualTypeOf<never>();
    expectTypeOf<ExtractQueryOperationTypes<SqliteEmitted>>().toEqualTypeOf<
      Record<string, never>
    >();
  });

  test('aggregate types', () => {
    expectTypeOf<
      DifferingKeys<ExtractAggregateTypes<PostgresBuilt>, ExtractAggregateTypes<PostgresEmitted>>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingKeys<ExtractAggregateTypes<SqliteBuilt>, ExtractAggregateTypes<SqliteEmitted>>
    >().toEqualTypeOf<never>();
  });

  test('field output types', () => {
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldOutputTypes<PostgresBuilt>>,
        NamespaceMaps<ExtractFieldOutputTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldOutputTypes<SqliteBuilt>>,
        NamespaceMaps<ExtractFieldOutputTypes<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldOutputTypes<RelationsBuilt>>,
        NamespaceMaps<ExtractFieldOutputTypes<RelationsEmitted>>
      >
    >().toEqualTypeOf<never>();
  });

  test('field input types', () => {
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldInputTypes<PostgresBuilt>>,
        NamespaceMaps<ExtractFieldInputTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldInputTypes<SqliteBuilt>>,
        NamespaceMaps<ExtractFieldInputTypes<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractFieldInputTypes<RelationsBuilt>>,
        NamespaceMaps<ExtractFieldInputTypes<RelationsEmitted>>
      >
    >().toEqualTypeOf<never>();
  });

  test('storage column types', () => {
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractStorageColumnTypes<PostgresBuilt>>,
        NamespaceMaps<ExtractStorageColumnTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractStorageColumnInputTypes<PostgresBuilt>>,
        NamespaceMaps<ExtractStorageColumnInputTypes<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractStorageColumnTypes<SqliteBuilt>>,
        NamespaceMaps<ExtractStorageColumnTypes<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ExtractStorageColumnInputTypes<SqliteBuilt>>,
        NamespaceMaps<ExtractStorageColumnInputTypes<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
  });
});

describe('the contract sections the ORM reads equal the emitted ones', () => {
  test('capabilities', () => {
    expectTypeOf<
      SameType<EnabledCapabilities<PostgresBuilt>, EnabledCapabilities<PostgresEmitted>>
    >().toEqualTypeOf<true>();
    expectTypeOf<
      SameType<EnabledCapabilities<SqliteBuilt>, EnabledCapabilities<SqliteEmitted>>
    >().toEqualTypeOf<true>();
  });

  test('column defaults', () => {
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ColumnsWithDefault<PostgresBuilt>>,
        NamespaceMaps<ColumnsWithDefault<PostgresEmitted>>
      >
    >().toEqualTypeOf<never>();
    expectTypeOf<
      DifferingPaths<
        NamespaceMaps<ColumnsWithDefault<SqliteBuilt>>,
        NamespaceMaps<ColumnsWithDefault<SqliteEmitted>>
      >
    >().toEqualTypeOf<never>();
  });

  test('client-generated defaults', () => {
    expectTypeOf<
      SameType<ExecutionDefaultRefs<RelationsBuilt>, ExecutionDefaultRefs<RelationsEmitted>>
    >().toEqualTypeOf<true>();
  });

  test('relations', () => {
    expectTypeOf<
      DifferingPaths<Relations<RelationsBuilt, 'public'>, Relations<RelationsEmitted, 'public'>>
    >().toEqualTypeOf<never>();
  });
});
