import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type ParadeDbErrorCode = `PARADEDB.${ParadeDbSubcode}`;

type ParadeDbSubcode = 'ARGUMENT_INVALID';

export function paradeDbError(
  code: ParadeDbErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
