import { EMPTY_CONTRACT_HASH } from '@internal/migration-tools/constants';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import { describe, expect, it } from 'vitest';
import {
  hasMigrationPath,
  refuseMarkerOutsideGraph,
} from '../../src/control-api/operations/graph-queries';
import { errorMarkerMismatch } from '../../src/utils/marker-mismatch';
import { buildGraph, entry } from '../utils/graph-helpers';

const HASH_A = `${'a'.repeat(64)}`;
const HASH_B = `${'b'.repeat(64)}`;
const HASH_FOREIGN = `${'f'.repeat(64)}`;

const graph = buildGraph([entry(EMPTY_CONTRACT_HASH, HASH_A, 'm1'), entry(HASH_A, HASH_B, 'm2')]);
const forkedGraph = buildGraph([
  entry(EMPTY_CONTRACT_HASH, HASH_A, 'm1'),
  entry(EMPTY_CONTRACT_HASH, HASH_B, 'm2'),
]);

describe('hasMigrationPath', () => {
  it('reports true when the graph contains a forward path', () => {
    expect(hasMigrationPath(graph, HASH_A, HASH_B)).toBe(true);
  });

  it('reports false when no path exists', () => {
    expect(hasMigrationPath(graph, HASH_B, HASH_A)).toBe(false);
  });
});

function refusalFor(markerHash: string, onGraph: MigrationGraph) {
  return refuseMarkerOutsideGraph({
    spaceId: 'app',
    markerHash,
    targetHash: HASH_B,
    graph: onGraph,
    migrationsDir: '/work/app/migrations',
    invocation: { cwd: '/work/app', configPath: undefined, dbGiven: false },
    readLedger: async () => [
      {
        space: 'app',
        migrationName: '20261001T0000_initial',
        migrationHash: 'sha256:initial',
        from: null,
        to: HASH_A,
        appliedAt: new Date(0),
        operationCount: 1,
      },
    ],
  });
}

describe('refuseMarkerOutsideGraph', () => {
  it('returns null when the marker hash is a graph node', async () => {
    expect(await refusalFor(HASH_A, graph)).toBeNull();
  });

  it('refuses with the MARKER_MISMATCH envelope the ledger explains', async () => {
    const refusal = await refusalFor(HASH_FOREIGN, graph);
    expect(refusal?.toEnvelope()).toEqual(
      errorMarkerMismatch({
        spaceId: 'app',
        markerHash: HASH_FOREIGN,
        targetHash: HASH_B,
        graph,
        migrationsDir: '/work/app/migrations',
        ledger: [
          {
            space: 'app',
            migrationName: '20261001T0000_initial',
            migrationHash: 'sha256:initial',
            from: null,
            to: HASH_A,
            appliedAt: new Date(0),
            operationCount: 1,
          },
        ],
        invocation: { cwd: '/work/app', configPath: undefined, dbGiven: false },
      }).toEnvelope(),
    );
  });

  it('refuses with MARKER_MISMATCH on a forked graph instead of failing on the fork', async () => {
    const refusal = await refusalFor(HASH_FOREIGN, forkedGraph);
    expect(refusal?.toEnvelope()).toMatchObject({
      code: 'MIGRATION.MARKER_MISMATCH',
      meta: { markerHash: HASH_FOREIGN, lastGraphHash: HASH_A, missingMigrations: [] },
    });
  });

  it('returns null when the marker is a node of a forked graph', async () => {
    expect(await refusalFor(HASH_B, forkedGraph)).toBeNull();
  });

  it('refuses without the ledger history when the ledger cannot be read', async () => {
    const refusal = await refuseMarkerOutsideGraph({
      spaceId: 'app',
      markerHash: HASH_FOREIGN,
      targetHash: HASH_B,
      graph,
      migrationsDir: '/work/app/migrations',
      invocation: { cwd: '/work/app', configPath: undefined, dbGiven: false },
      readLedger: async () => {
        throw new Error('connection reset');
      },
    });
    expect(refusal?.meta).toEqual({
      spaceId: 'app',
      markerHash: HASH_FOREIGN,
      targetHash: HASH_B,
      missingMigrations: [],
    });
  });
});
