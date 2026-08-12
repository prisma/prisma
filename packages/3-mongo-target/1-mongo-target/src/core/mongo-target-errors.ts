import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type MongoTargetErrorCode = `MIGRATION.${MigrationSubcode}`;

type MigrationSubcode = 'INVALID_OPERATION_ENTRY' | 'OPERATION_UNSUPPORTED';

export function mongoTargetError(
  code: MongoTargetErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
