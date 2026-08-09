import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import { errorNoInvariantPath, errorUnknownInvariant } from '@internal/migration-tools/errors';
import { findPathWithDecision } from '@internal/migration-tools/migration-graph';
import { describe, expect, it } from 'vitest';
import {
  refuseMissingInvariantPath,
  refuseUnknownInvariants,
} from '../../src/control-api/operations/invariants';
import { collectDeclaredInvariants, toStructuralEdge } from '../../src/utils/command-helpers';
import { buildGraph, entry } from '../utils/graph-helpers';

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;

const graph = buildGraph([
  entry(EMPTY_CONTRACT_HASH, HASH_A, 'm1'),
  { ...entry(HASH_A, HASH_B, 'm2'), invariants: ['inv-a'] },
]);

describe('refuseUnknownInvariants', () => {
  it('returns null when every ref invariant is declared on a graph edge', () => {
    expect(
      refuseUnknownInvariants({
        graph,
        markerInvariants: [],
        refInvariants: ['inv-a'],
        refName: 'production',
      }),
    ).toBeNull();
  });

  it('returns null when the invariant is only present on the live marker', () => {
    expect(
      refuseUnknownInvariants({
        graph,
        markerInvariants: ['inv-live'],
        refInvariants: ['inv-live'],
      }),
    ).toBeNull();
  });

  it('refuses an invariant neither declared nor on the marker with the UNKNOWN_INVARIANT envelope', () => {
    const refusal = refuseUnknownInvariants({
      graph,
      markerInvariants: [],
      refInvariants: ['inv-a', 'inv-x'],
      refName: 'production',
    });
    const declared = collectDeclaredInvariants(graph);
    expect(refusal?.toEnvelope()).toEqual(
      errorUnknownInvariant({
        refName: 'production',
        unknown: ['inv-x'],
        declared: [...declared].sort(),
      }).toEnvelope(),
    );
  });
});

describe('refuseMissingInvariantPath', () => {
  it('returns null when a path satisfies the missing invariants', () => {
    expect(
      refuseMissingInvariantPath({
        graph,
        originHash: HASH_A,
        targetHash: HASH_B,
        missing: ['inv-a'],
        refName: 'production',
      }),
    ).toBeNull();
  });

  it('refuses with the MIGRATION.NO_INVARIANT_PATH envelope when unsatisfiable', () => {
    const missing = ['inv-x'];
    const refusal = refuseMissingInvariantPath({
      graph,
      originHash: HASH_A,
      targetHash: HASH_B,
      missing,
      refName: 'production',
    });
    const outcome = findPathWithDecision(graph, HASH_A, HASH_B, {
      refName: 'production',
      required: new Set(missing),
    });
    expect(outcome.kind).toBe('unsatisfiable');
    if (outcome.kind === 'unsatisfiable') {
      expect(refusal?.toEnvelope()).toEqual(
        errorNoInvariantPath({
          refName: 'production',
          required: [...missing].sort(),
          missing: outcome.missing,
          structuralPath: outcome.structuralPath.map(toStructuralEdge),
        }).toEnvelope(),
      );
    }
  });
});
