import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { describe, expect, it } from 'vitest';
import {
  appliedHashesFromLedger,
  deriveStatusEdgeAnnotations,
  statusForMigrationHash,
} from '../../src/control-api/operations/migration-status-overlay';
import { mergeMigrationEdgeAnnotations } from '../../src/utils/formatters/migration-graph-space-render';
import { buildGraph, entry } from '../utils/graph-helpers';

const ROOT = EMPTY_CONTRACT_HASH;

describe('deriveStatusEdgeAnnotations', () => {
  it('marks ledger hashes as applied on the real DB origin', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1'), entry('A', 'B', 'm2')]);
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'B',
      originHash: 'A',
      appliedMigrationHashes: new Set([graph.migrationByHash.get('mid_m1')!.migrationHash]),
      showAppliedOverlay: true,
    });
    expect(statusForMigrationHash('mid_m1', annotations)).toBe('applied');
    expect(statusForMigrationHash('mid_m2', annotations)).toBe('pending');
  });

  it('omits applied overlay when showAppliedOverlay is false', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1'), entry('A', 'B', 'm2')]);
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'B',
      originHash: ROOT,
      appliedMigrationHashes: new Set([graph.migrationByHash.get('mid_m1')!.migrationHash]),
      showAppliedOverlay: false,
    });
    expect(statusForMigrationHash('mid_m1', annotations)).toBeNull();
    expect(statusForMigrationHash('mid_m2', annotations)).toBe('pending');
  });

  it('skips pending when the origin is not in the graph', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1')]);
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'A',
      originHash: 'off-graph-marker',
      appliedMigrationHashes: new Set(),
      showAppliedOverlay: true,
    });
    expect([...annotations.values()].some((a) => a.status === 'pending')).toBe(false);
  });

  it('lets applied win over pending on the same edge', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1'), entry('A', 'B', 'm2')]);
    const m2Hash = graph.migrationByHash.get('mid_m2')!.migrationHash;
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'B',
      originHash: ROOT,
      appliedMigrationHashes: new Set([m2Hash]),
      showAppliedOverlay: true,
    });
    expect(statusForMigrationHash(m2Hash, annotations)).toBe('applied');
  });

  it('marks every edge on the path when the marker is undefined', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1'), entry('A', 'B', 'm2')]);
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'B',
      originHash: ROOT,
      appliedMigrationHashes: new Set(),
      showAppliedOverlay: true,
    });
    expect(statusForMigrationHash('mid_m1', annotations)).toBe('pending');
    expect(statusForMigrationHash('mid_m2', annotations)).toBe('pending');
  });

  it('marks all edges applied when the marker is at the target', () => {
    const graph = buildGraph([entry(ROOT, 'A', 'm1'), entry('A', 'B', 'm2')]);
    const annotations = deriveStatusEdgeAnnotations({
      graph,
      targetHash: 'B',
      originHash: 'B',
      appliedMigrationHashes: new Set([
        graph.migrationByHash.get('mid_m1')!.migrationHash,
        graph.migrationByHash.get('mid_m2')!.migrationHash,
      ]),
      showAppliedOverlay: true,
    });
    expect(statusForMigrationHash('mid_m1', annotations)).toBe('applied');
    expect(statusForMigrationHash('mid_m2', annotations)).toBe('applied');
    expect([...annotations.values()].some((a) => a.status === 'pending')).toBe(false);
  });
});

describe('mergeMigrationEdgeAnnotations', () => {
  it('composes list package facts with status overlay', () => {
    const list = new Map([['mid_m1', { operationCount: 2, invariants: ['inv_a'] as const }]]);
    const status = new Map([['mid_m1', { status: 'pending' as const }]]);
    expect(mergeMigrationEdgeAnnotations(list, status).get('mid_m1')).toEqual({
      operationCount: 2,
      invariants: ['inv_a'],
      status: 'pending',
    });
  });
});

describe('appliedHashesFromLedger', () => {
  it('collects exact migration hashes from ledger rows', () => {
    expect(
      appliedHashesFromLedger([
        { migrationHash: 'a' },
        { migrationHash: 'b' },
        { migrationHash: 'a' },
      ]),
    ).toEqual(new Set(['a', 'b']));
  });
});
