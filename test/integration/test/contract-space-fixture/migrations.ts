import type {
  ContractSpaceHeadRef,
  MigrationPackage,
} from '@internal/framework-components/control';
import {
  TEST_BASELINE_INVARIANT_ID,
  TEST_BASELINE_MIGRATION_NAME,
  TEST_BOX_TABLE,
} from './constants';
import { TEST_HEAD_HASH } from './contract';

const baselineMetadata = {
  migrationHash: 'synthetic-test-contract-space-baseline-hash-v1',
  from: null,
  to: TEST_HEAD_HASH,
  providedInvariants: [TEST_BASELINE_INVARIANT_ID],
  createdAt: '2026-01-01T00:00:00.000Z',
} as const satisfies MigrationPackage['metadata'];

/**
 * Single baseline migration: creates the `test_box` table from the empty
 * schema. The op carries the same `invariantId` declared in the head ref,
 * so a runner that walks this migration graph from a fresh marker reaches
 * the head ref in one step.
 */
export const testContractSpaceBaselineMigration: MigrationPackage = {
  dirName: TEST_BASELINE_MIGRATION_NAME,
  metadata: baselineMetadata,
  ops: [
    {
      id: `${TEST_BOX_TABLE}.create`,
      label: `Create table "${TEST_BOX_TABLE}"`,
      operationClass: 'additive',
      invariantId: TEST_BASELINE_INVARIANT_ID,
    },
  ],
};

export const testContractSpaceHeadRef: ContractSpaceHeadRef = {
  hash: TEST_HEAD_HASH,
  invariants: [TEST_BASELINE_INVARIANT_ID],
};
