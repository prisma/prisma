import type { PreserveEmptyPredicate, StorageSort } from '@internal/contract/hashing';
import { computeStorageHash } from '@internal/contract/hashing';
import { ifDefined } from '@internal/utils/defined';
import { errorDescriptorHeadHashMismatch } from './errors';

/**
 * Inputs the helper needs to recompute the descriptor's storage hash and
 * compare it to the published `headRef.hash`. Kept structural so the SQL
 * family (and any future target family) can compose the check without
 * coupling to its own descriptor types.
 */
export interface DescriptorSelfConsistencyInputs {
  readonly extensionId: string;
  readonly target: string;
  readonly targetFamily: string;
  /**
   * Family-specific storage object. Typed as `unknown` so callers can
   * pass their own narrow storage shape (e.g. `SqlStorage`) without an
   * inline cast — the helper canonicalises through `JSON.stringify`
   * inside {@link computeStorageHash} and only requires a plain
   * record-shaped value at runtime.
   */
  readonly storage: unknown;
  readonly headRefHash: string;
  readonly shouldPreserveEmpty?: PreserveEmptyPredicate;
  readonly sortStorage?: StorageSort;
}

/**
 * Assert that an extension descriptor is self-consistent: the
 * `headRef.hash` it publishes must match the canonical hash recomputed
 * from its `contractSpace.contractJson`.
 *
 * Recomputes via {@link computeStorageHash} — the same canonical-JSON
 * pipeline the descriptor's own emit pipeline produced the hash with —
 * over `(target, targetFamily, storage)`. Mismatch indicates the
 * extension author bumped `contractJson` without rerunning emit, leaving
 * the descriptor's `headRef.hash` stale; the consumer-side helpers
 * (drift detection, on-disk artefact emission, runner marker writes) all
 * trust `headRef.hash` as the canonical identity, so a stale value would
 * silently corrupt every downstream boundary.
 *
 * Synchronous, pure, no I/O. Throws
 * `MIGRATION.DESCRIPTOR_HEAD_HASH_MISMATCH` on failure with both the
 * recomputed and published hashes in `meta` so callers can surface a
 * clear remediation hint without re-deriving them.
 */
export function assertDescriptorSelfConsistency(inputs: DescriptorSelfConsistencyInputs): void {
  // The published `storage.storageHash` is the *output* of the production
  // emit pipeline's `computeStorageHash` call, computed over a storage
  // object that did not yet carry `storageHash`. Recomputing against the
  // published storage as-is would feed the result back into its own input
  // and produce a different digest. Strip `storageHash` before
  // recomputing so the helper sees the same canonical shape the
  // descriptor's authoring pipeline saw.
  // The helper requires only a plain record-shaped storage value at
  // runtime; a single cast here keeps the public input type
  // family-agnostic (`unknown`) while still letting us strip the
  // descriptor-published `storageHash` before re-canonicalising.
  const storageRecord = inputs.storage as Record<string, unknown>;
  const { storageHash: _stripped, ...storageWithoutHash } = storageRecord;
  const recomputed = computeStorageHash({
    target: inputs.target,
    targetFamily: inputs.targetFamily,
    storage: storageWithoutHash,
    ...ifDefined('shouldPreserveEmpty', inputs.shouldPreserveEmpty),
    ...ifDefined('sortStorage', inputs.sortStorage),
  });
  if (recomputed !== inputs.headRefHash) {
    throw errorDescriptorHeadHashMismatch({
      extensionId: inputs.extensionId,
      recomputedHash: recomputed,
      headRefHash: inputs.headRefHash,
    });
  }
}
