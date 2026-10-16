import { isStructuredError } from '@internal/utils/structured-error';

/** The meta a contract the family refused to load carries, such as the columns whose defaults it refused, for the command to report. */
export function contractValidationMeta(error: unknown): Record<string, unknown> | undefined {
  return isStructuredError(error) && error.code === 'CONTRACT.VALIDATION_FAILED'
    ? error.meta
    : undefined;
}
