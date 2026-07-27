import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type PslCode = `PSL.${PslSubcode}`;

type PslSubcode = 'FORMAT_OPTION_INVALID' | 'PARSE_FAILED';

export function pslError(
  code: PslCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
