import type { Contract } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { createSqlContract } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { createAggregateContractSpace } from '../../src/aggregate/aggregate';
import type { IntegritySpaceState } from '../../src/aggregate/check-integrity';
import { computeIntegrityViolations } from '../../src/aggregate/check-integrity';
import { createAttestedPackage } from '../fixtures';

function contractWithTables(
  tables: readonly string[],
  namespaceId: string = UNBOUND_NAMESPACE_ID,
): Contract {
  const tableEntries = Object.fromEntries(tables.map((name) => [name, { columns: { id: {} } }]));
  return createSqlContract({
    target: 'postgres',
    storage: {
      namespaces: {
        [namespaceId]: { id: namespaceId, entries: { table: tableEntries } },
      },
    },
  });
}

function makeSpaceState(spaceId: string, contract: Contract, isApp = false): IntegritySpaceState {
  const space = createAggregateContractSpace({
    spaceId,
    packages: [],
    refs: {},
    headRef: isApp ? { hash: contract.storage.storageHash, invariants: [] } : null,
    refsDir: '/tmp/refs',
    migrationsDir: '/tmp/migrations',
    resolveContract: () => contract,
    deserializeContract: (raw) => raw as Contract,
  });
  return { space, problems: [], refProblems: [], headRefProblem: null, isApp };
}

describe('computeIntegrityViolations', () => {
  it('surfaces duplicateMigrationHash instead of throwing from graph()', () => {
    const sharedHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const first = createAttestedPackage('20260101T0000_first', { from: null, to: 't1' });
    const second = createAttestedPackage('20260101T0000_second', {
      from: 't1',
      to: 't2',
    });
    const packages = [
      { ...first, metadata: { ...first.metadata, migrationHash: sharedHash } },
      { ...second, metadata: { ...second.metadata, migrationHash: sharedHash } },
    ];

    const space = createAggregateContractSpace({
      spaceId: 'app',
      packages,
      refs: {},
      headRef: { hash: 't2', invariants: [] },
      refsDir: '/tmp/refs',
      migrationsDir: '/tmp/migrations',
      resolveContract: () => {
        throw new Error('unused in this test');
      },
      deserializeContract: (raw) => raw as Contract,
    });

    const state: IntegritySpaceState = {
      space,
      problems: [],
      refProblems: [],
      headRefProblem: null,
      isApp: true,
    };

    const violations = computeIntegrityViolations({ targetId: 'postgres', spaces: [state] });
    expect(violations).toContainEqual({
      kind: 'duplicateMigrationHash',
      spaceId: 'app',
      migrationHash: sharedHash,
      dirNames: ['20260101T0000_first', '20260101T0000_second'],
    });
    expect(() => space.graph()).not.toThrow();
  });

  describe('disjointness (checkContracts)', () => {
    it('reports a violation when two spaces claim the same (namespace, kind, name) primitive', () => {
      const app = makeSpaceState('app', contractWithTables(['users']), true);
      const ext = makeSpaceState('ext-auth', contractWithTables(['users']));

      const violations = computeIntegrityViolations(
        { targetId: 'postgres', spaces: [app, ext] },
        { checkContracts: true },
      );

      const disjoint = violations.filter((v) => v.kind === 'disjointness');
      expect(disjoint).toHaveLength(1);
      expect(disjoint[0]).toMatchObject({
        kind: 'disjointness',
        element: `${UNBOUND_NAMESPACE_ID}.users`,
        claimedBy: expect.arrayContaining(['app', 'ext-auth']),
      });
    });

    it('does not report a violation when same entity name appears in different namespaces across spaces', () => {
      // app declares public.users, extension declares auth.users — different coordinates, no collision
      const app = makeSpaceState('app', contractWithTables(['users'], 'public'), true);
      const ext = makeSpaceState('ext-auth', contractWithTables(['users'], 'auth'));

      const violations = computeIntegrityViolations(
        { targetId: 'postgres', spaces: [app, ext] },
        { checkContracts: true },
      );

      expect(violations.filter((v) => v.kind === 'disjointness')).toHaveLength(0);
    });

    it('does not report a violation when spaces claim different primitives in the same namespace', () => {
      const app = makeSpaceState('app', contractWithTables(['users']), true);
      const ext = makeSpaceState('ext-billing', contractWithTables(['invoices']));

      const violations = computeIntegrityViolations(
        { targetId: 'postgres', spaces: [app, ext] },
        { checkContracts: true },
      );

      expect(violations.filter((v) => v.kind === 'disjointness')).toHaveLength(0);
    });

    it('does not run the disjointness check without checkContracts', () => {
      const app = makeSpaceState('app', contractWithTables(['users']), true);
      const ext = makeSpaceState('ext-auth', contractWithTables(['users']));

      const violations = computeIntegrityViolations({ targetId: 'postgres', spaces: [app, ext] });

      expect(violations.filter((v) => v.kind === 'disjointness')).toHaveLength(0);
    });
  });

  it('rethrows when graph() fails for an unexpected reason', () => {
    // Give the space a package so packages.length > 0, which triggers the
    // graph-reachability check and therefore the graph() call.
    const pkg = createAttestedPackage('20260101T0000_init', { from: null, to: 'head' });
    const space = createAggregateContractSpace({
      spaceId: 'ext',
      packages: [pkg],
      refs: {},
      headRef: { hash: 'head', invariants: [] },
      refsDir: '/tmp/refs',
      migrationsDir: '/tmp/migrations',
      resolveContract: () => {
        throw new Error('unused');
      },
      deserializeContract: (raw) => raw as Contract,
    });
    const faultySpace = {
      ...space,
      graph() {
        throw new Error('engine fault');
      },
    };

    const state: IntegritySpaceState = {
      space: faultySpace,
      problems: [],
      refProblems: [],
      headRefProblem: null,
      isApp: false,
    };

    expect(() => computeIntegrityViolations({ targetId: 'postgres', spaces: [state] })).toThrow(
      'engine fault',
    );
  });
});
