/**
 * TS cross-space relation (Option B, non-navigable) + emitter
 *
 * Tests for cross-contract relation lowering:
 * - A cross-space `rel.belongsTo(ExtModel, …)` produces a domain relation whose
 *   `to.space` identifies the foreign contract space (CrossReference extended with `space?`)
 * - The relation still appears in the contract domain (introspectable)
 * - Missing-pack fail-fast for cross-space relations
 * - Local (same-space) relations are unchanged (no `to.space`)
 */

import type {
  ExtensionPackRef,
  FamilyPackRef,
  TargetPackRef,
} from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { defineContract, field, model, rel } from '../src/contract-builder';
import { ContractModelBuilder } from '../src/contract-dsl';
import { modelsOf } from './contract-test-helpers';
import { columnDescriptor } from './helpers/column-descriptor';

const bareFamilyPack: FamilyPackRef<'sql'> = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
};

const postgresTargetPack: TargetPackRef<'sql', 'postgres'> = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
};

const int4Column = columnDescriptor('pg/int4@1');
const textColumn = columnDescriptor('pg/text@1');

const supabasePack: ExtensionPackRef<'sql', 'postgres'> = {
  kind: 'extension',
  id: 'supabase',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
};

/** Synthetic supabase AuthUser handle for in-test use. */
function buildSyntheticSupabaseAuthUser() {
  return new ContractModelBuilder(
    {
      modelName: 'User' as const,
      namespace: 'auth',
      fields: {
        id: field.column(int4Column).id(),
        email: field.column(textColumn),
      },
      relations: {},
    },
    undefined,
    undefined,
    'supabase' as const,
  ).sql({ table: 'users' });
}

// ---------------------------------------------------------------------------
// Cross-space relation lowering — CrossReference carries space
// ---------------------------------------------------------------------------

describe('cross-space belongsTo relation lowering', () => {
  it('the relation to.space identifies the foreign contract space', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileModel = modelsOf(contract)['Profile'];
    const userRelation = profileModel?.relations?.['user'] as Record<string, unknown> | undefined;
    expect(userRelation).toBeDefined();
    const to = userRelation?.['to'] as Record<string, unknown> | undefined;
    // CrossReference extended with `space?: string` carries the contract-space identity
    expect(to?.['space']).toBe('supabase');
  });

  it('the relation to.namespace reflects the target namespace', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileModel = modelsOf(contract)['Profile'];
    const userRelation = profileModel?.relations?.['user'] as Record<string, unknown> | undefined;
    const to = userRelation?.['to'] as Record<string, unknown> | undefined;
    // The namespace is 'auth' (from the handle's namespace coordinate)
    expect(to?.['namespace']).toBe('auth');
  });

  it('cross-space relation appears in contract domain (still present/introspectable)', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileModel = modelsOf(contract)['Profile'];
    // relation must exist in the domain
    expect(Object.keys(profileModel?.relations ?? {})).toContain('user');
  });

  it('on block carries the correct localFields and model name', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileModel = modelsOf(contract)['Profile'];
    const userRelation = profileModel?.relations?.['user'] as Record<string, unknown> | undefined;
    const on = userRelation?.['on'] as Record<string, unknown> | undefined;
    expect(on?.['localFields']).toEqual(['userId']);
    // Target field 'id' maps to column 'id' on the ext model
    expect(on?.['targetFields']).toEqual(['id']);
    const to = userRelation?.['to'] as Record<string, unknown> | undefined;
    expect(to?.['model']).toBe('User');
  });
});

// ---------------------------------------------------------------------------
// Cross-space relation — missing-pack fail-fast (AC5 TS half)
// ---------------------------------------------------------------------------

describe('cross-space belongsTo relation — missing-pack fail-fast', () => {
  it('throws when a cross-space relation references a space not in extensions', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    expect(() =>
      defineContract({
        family: bareFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        // intentionally no extensions — 'supabase' undeclared
        models: { Profile },
      }),
    ).toThrow(/supabase/);
  });

  it('error message mentions extensions', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }),
    });

    expect(() =>
      defineContract({
        family: bareFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        models: { Profile },
      }),
    ).toThrow(/extensions/i);
  });
});

// ---------------------------------------------------------------------------
// F-lazy — lazy cross-space handle (thunk form) carries the cross-space brand
// ---------------------------------------------------------------------------

describe('F-lazy: lazy cross-space belongsTo handle carries the brand', () => {
  it('rel.belongsTo(() => ExtUser, …) sees the cross-space brand and emits to.space', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      // Lazy form — wraps ExtUser in a thunk
      user: rel.belongsTo(() => ExtUser, { from: 'userId', to: 'id' }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileModel = modelsOf(contract)['Profile'];
    const userRelation = profileModel?.relations?.['user'] as Record<string, unknown> | undefined;
    expect(userRelation).toBeDefined();
    const to = userRelation?.['to'] as Record<string, unknown> | undefined;
    // The lazy thunk must be resolved before the brand check
    expect(to?.['space']).toBe('supabase');
    expect(to?.['namespace']).toBe('auth');
  });
});

// ---------------------------------------------------------------------------
// F-relfk — cross-space belongsTo with .sql({ fk }) lowers to cross-space FK
// ---------------------------------------------------------------------------

describe('F-relfk: cross-space belongsTo().sql({ fk }) produces a cross-space FK in storage', () => {
  it('relation-derived FK carries spaceId when the belongsTo target is cross-space', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }).sql({
        fk: { onDelete: 'cascade' },
      }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const storage = contract.storage;
    const profileTable = Object.values(storage.namespaces)
      .flatMap((ns) => Object.values(ns.entries.table ?? {}))
      .find((t) => t !== undefined);

    const fks = profileTable?.foreignKeys ?? [];
    expect(fks).toHaveLength(1);
    // The relation-derived FK must carry the cross-space spaceId.
    expect(fks[0]!.target.spaceId).toBe('supabase');
    expect(fks[0]!.onDelete).toBe('cascade');
  });

  it('relation-derived FK carries every declared fk option', () => {
    const ExtUser = buildSyntheticSupabaseAuthUser();

    const Profile = model('Profile', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
    }).relations({
      user: rel.belongsTo(ExtUser, { from: 'userId', to: 'id' }).sql({
        fk: {
          name: 'profile_user_fk',
          onDelete: 'restrict',
          onUpdate: 'cascade',
          constraint: true,
          index: false,
        },
      }),
    });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      extensions: { supabase: supabasePack },
      models: { Profile },
    });

    const profileTable = Object.values(contract.storage.namespaces)
      .flatMap((ns) => Object.values(ns.entries.table ?? {}))
      .find((t) => t !== undefined);

    expect(profileTable?.foreignKeys[0]).toMatchObject({
      name: 'profile_user_fk',
      onDelete: 'restrict',
      onUpdate: 'cascade',
      target: { spaceId: 'supabase', namespaceId: 'auth' },
    });
  });
});

// ---------------------------------------------------------------------------
// Local relation regression (AC9) — local belongsTo stays unchanged
// ---------------------------------------------------------------------------

describe('local belongsTo relation regression (AC9)', () => {
  it('a local belongsTo relation has no to.space', () => {
    const User = model('User', {
      fields: {
        id: field.column(int4Column).id(),
        email: field.column(textColumn),
      },
    }).sql({ table: 'app_user' });

    const Post = model('Post', {
      fields: {
        id: field.column(int4Column).id(),
        authorId: field.column(int4Column),
      },
    })
      .relations({
        author: rel.belongsTo(User, { from: 'authorId', to: 'id' }),
      })
      .sql({ table: 'post' });

    const contract = defineContract({
      family: bareFamilyPack,
      target: postgresTargetPack,
      createNamespace: createTestSqlNamespace,
      models: { User, Post },
    });

    const postModel = modelsOf(contract)['Post'];
    const authorRelation = postModel?.relations?.['author'] as Record<string, unknown> | undefined;
    expect(authorRelation).toBeDefined();
    const to = authorRelation?.['to'] as Record<string, unknown> | undefined;
    // Local relations must NOT have space
    expect(to).not.toHaveProperty('space');
  });
});
