import { MigrationToolsError } from '@internal/migration-tools/errors';
import { notOk, type Result } from '@internal/utils/result';
import {
  CliStructuredError,
  errorContractValidationFailed,
  errorFileNotFound,
  errorSnapshotMissing,
  errorUnexpected,
  mapMigrationToolsError,
} from './cli-errors';

export function mapContractAtError(
  error: unknown,
  options?: { readonly artifactRole?: 'from' | 'to' },
): Result<never, CliStructuredError> {
  if (MigrationToolsError.is(error)) {
    switch (error.code) {
      case 'MIGRATION.REF_NOT_RESOLVABLE': {
        const refName =
          typeof error.details?.['refName'] === 'string'
            ? error.details['refName']
            : typeof error.details?.['identifier'] === 'string'
              ? error.details['identifier']
              : 'unknown';
        return notOk(errorSnapshotMissing(refName));
      }
      case 'MIGRATION.CONTRACT_DESERIALIZATION_FAILED': {
        const filePath =
          typeof error.details?.['filePath'] === 'string' ? error.details['filePath'] : 'unknown';
        const message =
          typeof error.details?.['message'] === 'string' ? error.details['message'] : error.message;
        return notOk(
          errorContractValidationFailed(
            `Predecessor contract at ${filePath} failed to deserialize: ${message}`,
            { where: { path: filePath } },
          ),
        );
      }
      case 'MIGRATION.INVALID_JSON': {
        const filePath =
          typeof error.details?.['filePath'] === 'string' ? error.details['filePath'] : 'unknown';
        const message =
          typeof error.details?.['parseError'] === 'string'
            ? error.details['parseError']
            : error.message;
        const role = options?.artifactRole ?? 'from';
        return notOk(
          errorContractValidationFailed(
            role === 'to'
              ? `Target contract at ${filePath} failed to deserialize: ${message}`
              : `Predecessor contract at ${filePath} failed to deserialize: ${message}`,
            { where: { path: filePath } },
          ),
        );
      }
      case 'MIGRATION.BUNDLE_NOT_FOUND_FOR_GRAPH_NODE':
        return notOk(
          errorUnexpected(error.message, {
            why: error.why,
            fix: error.fix,
          }),
        );
      case 'MIGRATION.CONTRACT_SNAPSHOT_MISSING': {
        const expectedPath =
          typeof error.details?.['expectedPath'] === 'string'
            ? error.details['expectedPath']
            : 'migrations/snapshots/';
        const role = options?.artifactRole ?? 'from';
        return notOk(
          errorFileNotFound(expectedPath, {
            why:
              role === 'to'
                ? `Target migration is missing its contract snapshot at ${expectedPath}`
                : `Predecessor migration is missing its contract snapshot at ${expectedPath}`,
            fix: 'Restore migrations/snapshots/ from version control, or re-run the command that produced this migration to regenerate its snapshot.',
          }),
        );
      }
      default:
        return notOk(mapMigrationToolsError(error));
    }
  }
  if (CliStructuredError.is(error)) {
    return notOk(error);
  }
  throw error;
}
