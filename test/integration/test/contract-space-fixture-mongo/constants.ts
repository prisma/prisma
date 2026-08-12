/**
 * Static names used by the Mongo synthetic test extension's contract
 * space.
 *
 * The extension's `headRef.hash` (and the contract's
 * `storage.storageHash`) are content-addressed and computed from the
 * storage IR — see {@link import('./contract').MONGO_TEST_HEAD_HASH}.
 * Keeping the names here and the hash next to the storage definition
 * lets the framework's descriptor self-consistency check pass without
 * manual hash bookkeeping.
 *
 * Companion to the SQL fixture under
 * {@link import('../contract-space-fixture/constants')}; the two share
 * a structural shape so the multi-family aggregate path can be
 * exercised the same way in either family.
 */

export const MONGO_TEST_SPACE_ID = 'test-mongo-contract-space';

export const MONGO_TEST_COLLECTION = 'test_audit_event';

export const MONGO_TEST_BASELINE_INVARIANT_ID =
  'test-mongo-contract-space:create-test_audit_event-v1';

export const MONGO_TEST_BASELINE_MIGRATION_NAME = '20260101T0000_create_test_audit_event';
