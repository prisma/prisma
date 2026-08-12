/**
 * Type-level invariant: `SupabaseRoleBinding['role']` stays pinned to the
 * public `'anon' | 'authenticated' | 'service_role'` union even though the
 * implementation derives it from the `SupabaseRole` enum handle's values tuple
 * (`../src/contract/roles`).
 */

import { expectTypeOf, test } from 'vitest';
import type { SupabaseRole } from '../src/contract/roles';
import type { SupabaseRoleBinding } from '../src/runtime/supabase-runtime';

test('SupabaseRole is the anon | authenticated | service_role union', () => {
  expectTypeOf<SupabaseRole>().toEqualTypeOf<'anon' | 'authenticated' | 'service_role'>();
});

test('SupabaseRoleBinding.role is the anon | authenticated | service_role union', () => {
  expectTypeOf<SupabaseRoleBinding['role']>().toEqualTypeOf<
    'anon' | 'authenticated' | 'service_role'
  >();
});
