import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import type { Contract } from '@internal/contract/types';
import { assembleDataTypes } from '@internal/framework-components/codec';
import type { SqlStorage } from '@internal/sql-contract/types';
import {
  autoincrement,
  createComposedAuthoringHelpers,
  defineContract,
  field,
  model,
} from '@internal/sql-contract-ts/contract-builder';
import { assemblePostgresCodecRegistryWithBuiltins } from '@internal/target-postgres/codecs';
import postgresPack from '@internal/target-postgres/pack';
import { postgresCreateNamespace } from '@internal/target-postgres/types';
import { describe, expectTypeOf, test } from 'vitest';
import { familyPack } from '../../../../2-authoring/contract-ts/test/helpers/generator-function-packs';
import type { Db } from '../../src/exports/types';

const dataTypeLookup = assembleDataTypes([postgresPack]).lookup;
const lookups = {
  codecLookup: assemblePostgresCodecRegistryWithBuiltins([], dataTypeLookup),
  dataTypeLookup,
};

const { gen } = createComposedAuthoringHelpers({
  ...lookups,
  family: familyPack,
  target: postgresPack,
});

const Account = model('Account', {
  fields: {
    id: field.column(int4Column).default(autoincrement()).id(),
    email: field.column(textColumn),
    nickname: field.column(textColumn).optional(),
    plan: field.column(textColumn).default('free'),
    token: field.column(textColumn).onCreate(gen.uuid()),
    slug: field.column(textColumn).default('none').onCreate(gen.uuid()),
    revision: field.column(textColumn).onUpdate(gen.uuid()),
  },
}).sql({ table: 'account' });

const PublicThing = model('PublicThing', {
  fields: {
    id: field.column(int4Column).id(),
    code: field.column(textColumn),
  },
}).sql({ table: 'thing' });

const ShadowThing = model('ShadowThing', {
  namespace: 'shadow',
  fields: {
    id: field.column(int4Column).id(),
    code: field.column(textColumn).onCreate(gen.uuid()),
  },
}).sql({ table: 'thing' });

const contract = defineContract({
  ...lookups,
  family: familyPack,
  target: postgresPack,
  createNamespace: postgresCreateNamespace,
  namespaces: ['shadow'],
  models: { Account, PublicThing, ShadowThing },
});

declare const db: Db<typeof contract>;
declare const widened: Db<Contract<SqlStorage>>;

type AccountRow = Parameters<typeof db.public.account.insert>[0][number];

describe('insert row of a contract-bound table', () => {
  test('requires each column that is not nullable and has no create default, by name', () => {
    expectTypeOf<AccountRow>().toEqualTypeOf<{
      readonly email: string;
      readonly revision: string;
      readonly id?: number;
      readonly nickname?: string | null;
      readonly plan?: string;
      readonly token?: string;
      readonly slug?: string;
    }>();
  });

  test('rejects a row that leaves out a required column', () => {
    // @ts-expect-error email is required
    db.public.account.insert([{ revision: 'r1' }]);
  });

  test('rejects a row that leaves out a column with only an onUpdate generator', () => {
    // @ts-expect-error revision has no create default
    db.public.account.insert([{ email: 'a@example.com' }]);
  });

  test('accepts rows that each set different optional columns', () => {
    db.public.account.insert([
      { email: 'a@example.com', revision: 'r1' },
      { email: 'b@example.com', revision: 'r1', nickname: 'b', plan: 'pro' },
      { email: 'c@example.com', revision: 'r1', id: 3, token: 't', slug: 's' },
    ]);
  });

  test('an onCreate generator in another namespace does not make a same-named column optional', () => {
    expectTypeOf<Parameters<typeof db.public.thing.insert>[0][number]>().toEqualTypeOf<{
      readonly id: number;
      readonly code: string;
    }>();
    expectTypeOf<Parameters<typeof db.shadow.thing.insert>[0][number]>().toEqualTypeOf<{
      readonly id: number;
      readonly code?: string;
    }>();
  });
});

describe('insert row of a widened contract', () => {
  test('requires no column', () => {
    widened['public']?.['any_table']?.insert([{}]);
  });
});

describe('update values', () => {
  test('are all optional', () => {
    db.public.account.update({ email: 'a@example.com' });
    db.public.account.update({});
  });
});
