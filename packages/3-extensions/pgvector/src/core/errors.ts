import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type PgVectorErrorCode =
  | 'RUNTIME.ENCODE_FAILED'
  | 'RUNTIME.DECODE_FAILED'
  | 'CONTRACT.ARGUMENT_INVALID';

export function pgVectorError(
  code: PgVectorErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
