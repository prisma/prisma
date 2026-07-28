import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type EmitterErrorCode =
  | 'CONFIG.VALIDATION_FAILED'
  | 'CONTRACT.NAMESPACE_INVALID'
  | 'CONTRACT.RELATION_INVALID';

export function emitterError(
  code: EmitterErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
