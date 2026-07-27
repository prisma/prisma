import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type ContractCode = `CONTRACT.${ContractSubcode}`;

type ContractSubcode = 'PACK_CONTRIBUTION_INVALID';

export function contractError(
  code: ContractCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
