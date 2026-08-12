/**
 * Type-level invariant: RoleBoundDb must not expose a connection() method.
 *
 * The security guarantee is facade-encapsulation — SupabaseRuntimeImpl inherits
 * a public connection() from SqlRuntimeBase, but the role-bound Db surface must
 * never surface it. This test locks the compile-time side of that invariant.
 */

import { expectTypeOf, test } from 'vitest';
import type { RoleBoundDb } from '../src/runtime/supabase';

test('RoleBoundDb has no connection property', () => {
  expectTypeOf<RoleBoundDb<never>>().not.toHaveProperty('connection');
});
