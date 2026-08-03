/**
 * Type tests for demo DX with split Contract + TypeMaps.
 *
 * Verifies emitted workflow uses Contract and TypeMaps for correct lane inference,
 * and that runtime Contract value aligns with type (no HMR/type divergence).
 *
 * Spec: agent-os/specs/2026-02-15-runtime-dx-ir-shaped-contract-mappings-on-executioncontext/spec.md
 */

import type { ResultType } from '@prisma/orm-postgres/components/runtime';
import type { EnumMemberNames, EnumValues } from '@prisma/orm-postgres/contract/enum-accessor';
import { PostgresContractSerializer } from '@prisma/orm-postgres/target/runtime';
import { expectTypeOf, test } from 'vitest';
import type { Contract, FieldOutputTypes, TypeMaps } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { db } from '../src/prisma/db';
import type { getPostsByPriority } from '../src/queries/get-posts-by-priority';

// Models resolve per-namespace from the domain plane (no flat top-level Models export).
type Models = Contract['domain']['namespaces']['public']['models'];

test('contract.d.ts exports Contract and TypeMaps separately', () => {
  expectTypeOf<Contract>().toHaveProperty('domain');
  expectTypeOf<TypeMaps>().toHaveProperty('codecTypes');
  expectTypeOf<TypeMaps>().toHaveProperty('queryOperationTypes');
});

test('SPI deserializeContract output is assignable to visualization shape', () => {
  const contract = new PostgresContractSerializer().deserializeContract<Contract>(contractJson);

  expectTypeOf<Models>().toHaveProperty('User');
  expectTypeOf<Models>().toHaveProperty('Post');
  expectTypeOf(contract.storage.namespaces['public'].entries.table).toHaveProperty('user');
  expectTypeOf(contract.storage.namespaces['public'].entries.table).toHaveProperty('post');
  expectTypeOf(contract.domain.namespaces['public']!.models.User.storage.fields).toHaveProperty(
    'email',
  );
  expectTypeOf(contract.domain.namespaces['public']!.models.Post.storage.fields).toHaveProperty(
    'userId',
  );
});

test('emitted contract.d.ts types Post.priority as the value union, not string', () => {
  type PriorityOutput = FieldOutputTypes['public']['Post']['priority'];
  expectTypeOf<PriorityOutput>().toEqualTypeOf<'low' | 'high' | 'urgent'>();
  expectTypeOf<PriorityOutput>().not.toEqualTypeOf<string>();
});

// Emit vs no-emit agreement. The emitted `FieldOutputTypes` enum field type
// (produced on the emit path via the codec seam) must equal the enum's authored
// value union carried by `db.enums` (the no-emit reference — the authored member
// values propagated without serialization). Same enum, both paths, one union.
test('emitted Post.priority field type equals the no-emit db.enums value union', () => {
  type EmittedPriority = FieldOutputTypes['public']['Post']['priority'];
  type NoEmitPriorityValues = EnumValues<typeof db.enums.public.Priority>;
  expectTypeOf<EmittedPriority>().toEqualTypeOf<NoEmitPriorityValues>();
});

test('emitted contract: db.sql.public.post SELECT priority yields the value union', () => {
  const plan = db.sql.public.post.select('id', 'priority').build();
  type Row = ResultType<typeof plan>;
  expectTypeOf<Row['priority']>().toEqualTypeOf<'low' | 'high' | 'urgent'>();
  expectTypeOf<Row['priority']>().not.toEqualTypeOf<string>();
});

test('emitted contract: getPostsByPriority rows have priority typed as the value union', async () => {
  type Rows = Awaited<ReturnType<typeof getPostsByPriority>>;
  type RowPriority = Rows[number]['priority'];
  expectTypeOf<RowPriority>().toEqualTypeOf<'low' | 'high' | 'urgent'>();
  expectTypeOf<RowPriority>().not.toEqualTypeOf<string>();
});

test('emitted contract: db.sql.public.post INSERT rejects values outside the union', () => {
  db.sql.public.post.insert([{ id: 'a', title: 'ok', userId: 'u', priority: 'high' }]).build();

  db.sql.public.post.insert([
    // @ts-expect-error 'nope' is not a Priority member value
    { id: 'b', title: 'bad', userId: 'u', priority: 'nope' },
  ]);
});

test('emitted contract: db.enums.public.Priority yields literal types through the emitted contract.d.ts', () => {
  type MemberHigh = (typeof db.enums.public.Priority)['members']['High'];
  type Values = (typeof db.enums.public.Priority)['values'];

  expectTypeOf<MemberHigh>().toEqualTypeOf<'high'>();
  expectTypeOf<MemberHigh>().not.toEqualTypeOf<string>();

  expectTypeOf<Values[0]>().toEqualTypeOf<'low'>();
  expectTypeOf<Values[1]>().toEqualTypeOf<'high'>();
  expectTypeOf<Values[2]>().toEqualTypeOf<'urgent'>();
  expectTypeOf<Values[0]>().not.toEqualTypeOf<string>();
});

test('emitted contract: EnumValues<Priority> resolves to the literal value union via emitted contract', () => {
  type Priority = typeof db.enums.public.Priority;
  expectTypeOf<EnumValues<Priority>>().toEqualTypeOf<'low' | 'high' | 'urgent'>();
  expectTypeOf<EnumValues<Priority>>().not.toEqualTypeOf<string>();
});

test('emitted contract: EnumMemberNames<Priority> resolves to the literal name union via emitted contract', () => {
  type Priority = typeof db.enums.public.Priority;
  expectTypeOf<EnumMemberNames<Priority>>().toEqualTypeOf<'Low' | 'High' | 'Urgent'>();
  expectTypeOf<EnumMemberNames<Priority>>().not.toEqualTypeOf<string>();
});
