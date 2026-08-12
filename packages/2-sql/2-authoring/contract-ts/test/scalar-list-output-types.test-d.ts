/**
 * Type-level proof that a `many` storage column generates `ReadonlyArray<Element>`
 * in the no-emit (`FieldOutputType`) path in SqlContractResult.
 *
 * The emit path (`contract.d.ts` FieldOutputTypes) is driven by
 * `domain-type-generation.applyModifiers` in the framework emitter package,
 * which already handles `many: true` via the domain ContractField. That
 * behaviour is covered by the emitter's own tests.
 *
 * Container nullability: `T[]` → `ReadonlyArray<string>`;
 *                        `T[]?` → `ReadonlyArray<string> | null`.
 */

import type { ColumnTypeDescriptor } from '@internal/framework-components/codec';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import type {
  ExtractCodecTypes,
  ExtractFieldOutputTypes,
  ExtractStorageColumnInputTypes,
  ExtractStorageColumnTypes,
} from '@internal/sql-contract/types';
import { expectTypeOf, test } from 'vitest';
import { field, model } from '../src/contract-builder';
import type { SqlContractResult } from '../src/contract-types';

type TextCodecTypes = {
  readonly 'pg/text@1': { readonly input: string; readonly output: string };
};

// Target pack with __codecTypes required so CodecTypesFromDefinition resolves
// pg/text@1 → string without undefined in the union.
declare const typedPostgresPack: TargetPackRef<'sql', 'postgres'> & {
  readonly __codecTypes: TextCodecTypes;
};

const bareFamilyPack: FamilyPackRef<'sql'> = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
};

// Declare a precisely-typed column descriptor so the codecId literal ('pg/text@1')
// flows through ScalarFieldState's descriptor generic and into FieldOutputType.
declare const textColumn: ColumnTypeDescriptor<'pg/text@1'>;

const definition = {
  family: bareFamilyPack,
  target: typedPostgresPack,
  models: {
    Post: model('Post', {
      fields: {
        id: field.column(textColumn).id(),
        tags: field.column(textColumn).many(),
        optTags: field.column(textColumn).many().optional(),
      },
    }).sql({ table: 'posts' }),
  },
};

type Contract = SqlContractResult<typeof definition>;
type FieldTypes = ExtractFieldOutputTypes<Contract>['public']['Post'];
type StorageOutputTypes = ExtractStorageColumnTypes<Contract>['public']['posts'];
type StorageInputTypes = ExtractStorageColumnInputTypes<Contract>['public']['posts'];

test('codec types include pg/text@1', () => {
  expectTypeOf<
    'pg/text@1' extends keyof ExtractCodecTypes<Contract> ? true : false
  >().toEqualTypeOf<true>();
});

test('non-null list field resolves to ReadonlyArray<string>', () => {
  expectTypeOf<FieldTypes['tags']>().toEqualTypeOf<ReadonlyArray<string>>();
});

test('nullable-container list field resolves to ReadonlyArray<string> | null', () => {
  expectTypeOf<FieldTypes['optTags']>().toEqualTypeOf<ReadonlyArray<string> | null>();
});

test('scalar field is unaffected', () => {
  expectTypeOf<FieldTypes['id']>().toEqualTypeOf<string>();
});

test('non-null list storage column resolves to ReadonlyArray<string>', () => {
  expectTypeOf<StorageOutputTypes['tags']>().toEqualTypeOf<ReadonlyArray<string>>();
  expectTypeOf<StorageInputTypes['tags']>().toEqualTypeOf<ReadonlyArray<string>>();
});

test('nullable-container list storage column resolves to ReadonlyArray<string> | null', () => {
  expectTypeOf<StorageOutputTypes['optTags']>().toEqualTypeOf<ReadonlyArray<string> | null>();
  expectTypeOf<StorageInputTypes['optTags']>().toEqualTypeOf<ReadonlyArray<string> | null>();
});

test('scalar storage column is unaffected', () => {
  expectTypeOf<StorageOutputTypes['id']>().toEqualTypeOf<string>();
});
