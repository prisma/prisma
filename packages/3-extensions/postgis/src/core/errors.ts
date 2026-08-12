import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

export type PostgisErrorCode =
  | 'RUNTIME.ENCODE_FAILED'
  | 'RUNTIME.DECODE_FAILED'
  | 'CONTRACT.ARGUMENT_INVALID'
  | `POSTGIS.${PostgisSubcode}`;

type PostgisSubcode = 'GEOMETRY_INVALID';

export function postgisError(
  code: PostgisErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
