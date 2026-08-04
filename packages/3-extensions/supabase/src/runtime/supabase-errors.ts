import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type SupabaseCode = `SUPABASE.${SupabaseSubcode}`;

type SupabaseSubcode = 'CONFIG_INVALID' | 'JWT_INVALID';

export function supabaseError(
  code: SupabaseCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
