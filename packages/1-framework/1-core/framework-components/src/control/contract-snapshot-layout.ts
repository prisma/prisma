import { InternalError } from '@internal/utils/internal-error';

export const CONTRACT_SNAPSHOTS_DIRNAME = 'snapshots';

const STORAGE_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Validate a storage hash for use as a directory name. */
export function storageHashHex(storageHash: string): string {
  if (!STORAGE_HASH_PATTERN.test(storageHash)) {
    throw new InternalError(
      `Invalid storage hash "${storageHash}": expected 64 lowercase hex characters`,
    );
  }
  return storageHash;
}

/** Module specifier for the store's `contract.json`, POSIX separators. */
export function contractSnapshotJsonSpecifier(
  snapshotsImportPath: string,
  storageHash: string,
): string {
  return `${snapshotsImportPath}/${storageHashHex(storageHash)}/contract.json`;
}

/** Type-only module specifier for the store's `contract.d.ts` (no extension). */
export function contractSnapshotTypesSpecifier(
  snapshotsImportPath: string,
  storageHash: string,
): string {
  return `${snapshotsImportPath}/${storageHashHex(storageHash)}/contract`;
}
