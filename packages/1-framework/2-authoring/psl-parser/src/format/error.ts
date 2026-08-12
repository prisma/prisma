import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type PslCode = `PSL.${PslSubcode}`;

type PslSubcode = 'FORMAT_OPTION_INVALID' | 'PARSE_FAILED';

export function pslError(
  code: PslCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
