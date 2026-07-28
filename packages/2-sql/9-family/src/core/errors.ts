import type { StructuredError, StructuredErrorOptions } from '@prisma-next/utils/structured-error';
import { structuredError } from '@prisma-next/utils/structured-error';

type SqlFamilyErrorCode =
  | 'CONTRACT.ENUM_INVALID'
  | 'CONTRACT.ENUM_UNKNOWN'
  | 'CONTRACT.FOREIGN_KEY_INVALID'
  | 'CONTRACT.INFER_UNSUPPORTED'
  | 'CONTRACT.MARKER_ROW_CORRUPT'
  | 'CONTRACT.NAMESPACE_UNKNOWN'
  | 'CONTRACT.PACK_CONTRIBUTION_INVALID'
  | 'CONTRACT.TABLE_AMBIGUOUS'
  | 'CONTRACT.TYPE_UNKNOWN'
  | 'MIGRATION.MARKER_CAS_FAILURE';

export function sqlFamilyError(
  code: SqlFamilyErrorCode,
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  return structuredError(code, message, options);
}
