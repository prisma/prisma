/**
 * Type-level invariants for the service_role namespace surface.
 *
 * Typed with the real example app contract (`../src/contract`), which declares
 * only the `public` namespace (with `profile`) and has no `auth` / `storage`.
 * That is the whole point: the negative assertions below would be vacuous
 * against a contract that already carried `auth` / `storage`.
 *
 * Proven here:
 *   1. The Supabase-internal namespaces (`auth`, `storage`) live ONLY on the
 *      `asServiceRole().supabase` secondary root, on both `.sql` and `.orm`.
 *   2. The primary root (`asServiceRole().sql` / `.orm`) is app-only — no
 *      `auth` / `storage` — exactly like `asAnon()` / `asUser(jwt)`.
 *   3. Only `asServiceRole()` carries a `.supabase` property; `asAnon()` /
 *      `asUser(jwt)` do not.
 */

import type { RoleBoundDb, SupabaseDb } from '@prisma/orm-extension-supabase/runtime';
import { expectTypeOf, test } from 'vitest';
import type { Contract } from '../src/contract';

const db = {} as SupabaseDb<Contract>;

test('asServiceRole().supabase.sql exposes the internal auth and storage namespaces', () => {
  const internal = db.asServiceRole().supabase;
  expectTypeOf(internal.sql).toHaveProperty('auth');
  expectTypeOf(internal.sql).toHaveProperty('storage');
});

test('asServiceRole().supabase.orm exposes the internal auth and storage namespaces', () => {
  const internal = db.asServiceRole().supabase;
  expectTypeOf(internal.orm).toHaveProperty('auth');
  expectTypeOf(internal.orm).toHaveProperty('storage');
});

test('asServiceRole() primary root is app-only — public but not auth/storage', () => {
  const sr = db.asServiceRole();
  expectTypeOf(sr.sql).toHaveProperty('public');
  expectTypeOf(sr.sql).not.toHaveProperty('auth');
  expectTypeOf(sr.sql).not.toHaveProperty('storage');
  expectTypeOf(sr.orm).toHaveProperty('public');
  expectTypeOf(sr.orm).not.toHaveProperty('auth');
  expectTypeOf(sr.orm).not.toHaveProperty('storage');
});

test('asAnon() is app-only and has no .supabase secondary root', () => {
  const anon = db.asAnon();
  expectTypeOf(anon.sql).toHaveProperty('public');
  expectTypeOf(anon.sql).not.toHaveProperty('auth');
  expectTypeOf(anon.sql).not.toHaveProperty('storage');
  expectTypeOf(anon).not.toHaveProperty('supabase');
});

test('asUser(jwt) is app-only and has no .supabase secondary root', async () => {
  const user = await db.asUser('jwt');
  expectTypeOf(user.sql).not.toHaveProperty('auth');
  expectTypeOf(user.sql).not.toHaveProperty('storage');
  expectTypeOf(user.orm).not.toHaveProperty('auth');
  expectTypeOf(user.orm).not.toHaveProperty('storage');
  expectTypeOf(user).not.toHaveProperty('supabase');
});

test('asAnon() and asUser() return the plain app-contract RoleBoundDb', async () => {
  expectTypeOf(db.asAnon()).toEqualTypeOf<RoleBoundDb<Contract>>();
  expectTypeOf(await db.asUser('jwt')).toEqualTypeOf<RoleBoundDb<Contract>>();
});
