import type {
  SnapshotCanonicalizationHooks,
  SnapshotContentVerifier,
} from '@internal/migration-tools/contract-snapshot-store';
import { createSnapshotContentVerifier } from '@internal/migration-tools/contract-snapshot-store';
import { ifDefined } from '@internal/utils/defined';

/**
 * Build the per-command snapshot content verifier from the target's
 * `ContractSerializer`, which carries the family canonicalization hooks the
 * emit pipeline hashed with. Every target descriptor ships the serializer;
 * the absent case exists only for structural test stand-ins, which read
 * without content verification.
 */
export function snapshotVerifierFor(config: {
  readonly target: { readonly contractSerializer?: SnapshotCanonicalizationHooks };
}): SnapshotContentVerifier | undefined {
  const serializer = config.target.contractSerializer;
  if (serializer === undefined) {
    return undefined;
  }
  return createSnapshotContentVerifier({
    ...ifDefined('shouldPreserveEmpty', serializer.shouldPreserveEmpty),
    ...ifDefined('sortStorage', serializer.sortStorage),
  });
}
