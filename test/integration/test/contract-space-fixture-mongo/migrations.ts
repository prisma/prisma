import type {
  ContractSpaceHeadRef,
  MigrationPackage,
} from '@internal/framework-components/control';
import {
  MONGO_TEST_BASELINE_INVARIANT_ID,
  MONGO_TEST_BASELINE_MIGRATION_NAME,
  MONGO_TEST_COLLECTION,
} from './constants';
import { MONGO_TEST_HEAD_HASH } from './contract';

const baselineMetadata = {
  migrationHash: 'synthetic-mongo-test-contract-space-baseline-hash-v1',
  from: null,
  to: MONGO_TEST_HEAD_HASH,
  providedInvariants: [MONGO_TEST_BASELINE_INVARIANT_ID],
  createdAt: '2026-01-01T00:00:00.000Z',
} as const satisfies MigrationPackage['metadata'];

/**
 * Single baseline migration: creates the `test_audit_event` collection
 * from the empty schema. The op carries the same `invariantId`
 * declared in the head ref, so a runner that walks this migration
 * graph from a fresh marker reaches the head ref in one step.
 *
 * Symbolic ops (framework-level
 * {@link import('@internal/framework-components/control').MigrationPlanOperation}
 * shape — `id`/`label`/`operationClass`/`invariantId` only). The
 * runtime DDL commands that actually create the collection / index /
 * validator are derived from `contractJson` by the Mongo planner at
 * apply time (see `MongoMigrationPlanner` in `target-mongo`); this
 * fixture's ops carry the framework metadata needed by the seed-phase
 * and the verifier's invariant-derivation pass, not the planner IR
 * itself.
 */
export const mongoTestContractSpaceBaselineMigration: MigrationPackage = {
  dirName: MONGO_TEST_BASELINE_MIGRATION_NAME,
  metadata: baselineMetadata,
  ops: [
    {
      id: `${MONGO_TEST_COLLECTION}.create`,
      label: `Create collection "${MONGO_TEST_COLLECTION}"`,
      operationClass: 'additive',
      invariantId: MONGO_TEST_BASELINE_INVARIANT_ID,
    },
  ],
};

export const mongoTestContractSpaceHeadRef: ContractSpaceHeadRef = {
  hash: MONGO_TEST_HEAD_HASH,
  invariants: [MONGO_TEST_BASELINE_INVARIANT_ID],
};
