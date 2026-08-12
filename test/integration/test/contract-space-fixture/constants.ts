/**
 * Static names used by the synthetic test extension's contract space.
 *
 * The extension's `headRef.hash` (and the contract's `storage.storageHash`)
 * are content-addressed and computed from the storage IR — see
 * {@link import('./contract').TEST_HEAD_HASH}. Keeping the names here and
 * the hash next to the storage definition lets the framework's descriptor
 * self-consistency check pass without manual hash bookkeeping.
 */

export const TEST_SPACE_ID = 'test-contract-space';

export const TEST_BOX_TABLE = 'test_box';

export const TEST_BASELINE_INVARIANT_ID = 'test-contract-space:create-test_box-v1';

export const TEST_BASELINE_MIGRATION_NAME = '20260101T0000_create_test_box';
