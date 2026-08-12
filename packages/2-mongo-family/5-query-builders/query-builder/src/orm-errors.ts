import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type OrmCode = `ORM.${OrmSubcode}`;

type OrmSubcode =
  | 'ARGUMENT_INVALID'
  | 'MODEL_UNKNOWN'
  | 'MUTATION_DATA_MISSING'
  | 'OPERATION_UNSUPPORTED';

export function ormError(
  code: OrmCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
