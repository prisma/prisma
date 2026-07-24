import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type SqliteErrorCode =
  | 'RUNTIME.BINDING_MISSING'
  | 'DRIVER.NOT_CONNECTED'
  | 'DRIVER.ALREADY_CONNECTED';

export function sqliteError(
  code: SqliteErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
