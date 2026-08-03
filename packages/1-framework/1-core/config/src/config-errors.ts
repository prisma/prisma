import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type ConfigCode = `CONFIG.${ConfigSubcode}`;

type ConfigSubcode = 'VALIDATION_FAILED';

export function configError(
  code: ConfigCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
