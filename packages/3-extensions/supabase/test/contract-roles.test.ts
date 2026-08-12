/**
 * Supabase role surface exported from `@internal/extension-supabase/contract`:
 *
 * 1. `anon` / `authenticated` are plain RLS role reference handles (built with
 *    the postgres contract-builder's `role(...)`) usable in a policy's
 *    `roles:` list. Supabase provisions these roles at runtime — referencing
 *    them lowers to bare names without declaring them, matching PSL's
 *    bare-identifier pass-through.
 *
 * 2. Contract shape — pins the shipped `contract.json` to `SupabaseRole.values`,
 *    the single source of truth for the Supabase role vocabulary. Roles are
 *    authored inside `namespace unbound { … }` in `contract.prisma` and lower
 *    into the contract's `__unbound__` storage slot, each hydrated as a
 *    `control: 'external'` role entity bound to the `__unbound__` namespace
 *    coordinate (roles are cluster-scoped in Postgres).
 */
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { describe, expect, it } from 'vitest';
import contractJson from '../src/contract/contract.json' with { type: 'json' };
import { SupabaseRole } from '../src/contract/roles';
import { anon, authenticated } from '../src/exports/contract';

describe('supabase role handles', () => {
  it('anon and authenticated are frozen role handles carrying their bare names', () => {
    expect(anon).toEqual({ entityKind: 'role', name: 'anon' });
    expect(authenticated).toEqual({ entityKind: 'role', name: 'authenticated' });
    expect(Object.isFrozen(anon)).toBe(true);
    expect(Object.isFrozen(authenticated)).toBe(true);
  });
});

describe('contract roles — __unbound__ slot matches SupabaseRole.values', () => {
  const serializer = new PostgresContractSerializer();
  const contract = serializer.deserializeContract(contractJson);
  const unboundNamespace = contract.storage.namespaces['__unbound__'];
  const roleEntries = (unboundNamespace?.entries['role'] ?? {}) as Record<string, unknown>;

  it('role entry names are exactly SupabaseRole.values', () => {
    expect(Object.keys(roleEntries).sort()).toEqual([...SupabaseRole.values].sort());
  });

  it.each(SupabaseRole.values)(
    'role "%s" is control:external, bound to __unbound__',
    (roleName) => {
      expect(roleEntries[roleName]).toEqual({
        kind: 'role',
        name: roleName,
        namespaceId: '__unbound__',
        control: 'external',
      });
    },
  );
});
