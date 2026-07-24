import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

export type MongoFacadeCode =
  | 'RUNTIME.BINDING_INVALID'
  | 'RUNTIME.BINDING_MISSING'
  | 'DRIVER.NOT_CONNECTED'
  | 'DRIVER.ALREADY_CONNECTED';

export function mongoError(
  code: MongoFacadeCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, {
    ...options,
    meta: { ...options?.meta, extension: 'mongo' },
  });
}
