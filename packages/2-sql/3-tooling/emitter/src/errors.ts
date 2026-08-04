import type { StructuredError, StructuredErrorOptions } from '@internal/utils/structured-error';
import { structuredError } from '@internal/utils/structured-error';

type SqlEmitterErrorCode =
  | 'CONTRACT.AGGREGATE_DESCRIPTOR_AMBIGUOUS'
  | 'CONTRACT.AGGREGATE_OUTPUT_CODEC_MISSING'
  | 'CONTRACT.NAME_DUPLICATE'
  | 'CONTRACT.NAMESPACE_INVALID'
  | 'CONTRACT.TYPE_UNKNOWN'
  | 'CONTRACT.VALIDATION_FAILED';

export function sqlEmitterError(
  code: SqlEmitterErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}

export function sqlEmitterValidationError(
  message: string,
  meta: Record<string, unknown>,
): StructuredError {
  return sqlEmitterError('CONTRACT.VALIDATION_FAILED', message, {
    why: 'The contract given to the SQL emitter failed structural validation.',
    fix: 'Regenerate the contract from its authoring source; do not hand-edit contract JSON.',
    meta,
  });
}
