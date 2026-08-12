import type { MigrationPlanOperation } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import {
  TEST_BASELINE_INVARIANT_ID,
  TEST_BASELINE_MIGRATION_NAME,
  TEST_BOX_TABLE,
  TEST_SPACE_ID,
} from './constants';
import { TEST_HEAD_HASH } from './contract';
import testContractSpaceExtensionDescriptor from './control';

describe('test-contract-space fixture descriptor', () => {
  it('identifies as a SQL extension targeted at postgres', () => {
    expect(testContractSpaceExtensionDescriptor).toMatchObject({
      kind: 'extension',
      id: TEST_SPACE_ID,
      familyId: 'sql',
      targetId: 'postgres',
    });
  });

  it('exposes a contractSpace whose contract declares the test_box table', () => {
    const space = testContractSpaceExtensionDescriptor.contractSpace;
    expect(space).toBeDefined();
    const ns = space!.contractJson.storage.namespaces[UNBOUND_NAMESPACE_ID]!;
    expect(Object.keys(ns.entries.table ?? {})).toEqual([TEST_BOX_TABLE]);
  });

  it('publishes one baseline migration that establishes the head invariant', () => {
    const space = testContractSpaceExtensionDescriptor.contractSpace!;
    expect(space.migrations).toHaveLength(1);
    const baseline = space.migrations[0]!;
    expect(baseline.dirName).toBe(TEST_BASELINE_MIGRATION_NAME);
    expect(baseline.metadata.providedInvariants).toEqual([TEST_BASELINE_INVARIANT_ID]);
    const opIds = baseline.ops.map((op: MigrationPlanOperation) => op.invariantId);
    expect(opIds).toContain(TEST_BASELINE_INVARIANT_ID);
  });

  it('points the head ref at the baseline-applied state', () => {
    const headRef = testContractSpaceExtensionDescriptor.contractSpace!.headRef;
    expect(headRef).toEqual({
      hash: TEST_HEAD_HASH,
      invariants: [TEST_BASELINE_INVARIANT_ID],
    });
  });
});
