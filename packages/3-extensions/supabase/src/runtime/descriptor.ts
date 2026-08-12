import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import packageJson from '../../package.json' with { type: 'json' };

/**
 * Tells the runtime that the Supabase pack's runtime component is available.
 *
 * When a contract declares the Supabase pack, the runtime checks that a
 * matching descriptor has been registered. Without this, loading a Supabase
 * contract errors with "pack runtime component missing". The `supabase()`
 * factory registers this descriptor automatically — app code never needs to
 * reference it directly.
 */
export const supabaseRuntimeDescriptor: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension' as const,
  id: 'supabase',
  version: packageJson.version,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  codecs: () => [],
  create() {
    return {
      familyId: 'sql' as const,
      targetId: 'postgres' as const,
    };
  },
};
