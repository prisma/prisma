import { describe, expect, it } from 'vitest';
import type { MigrationStatusResult } from '../src/commands/json/schemas';
import type { MigrateResult } from '../src/commands/migrate';

describe('MigrateResult JSON shape (aggregate-walking)', () => {
  it('pins keys for an apply that touched both an extension and the app space', () => {
    const result: MigrateResult = {
      ok: true,
      migrationsApplied: 2,
      migrationsTotal: 2,
      markerHash: 'app',
      applied: [
        {
          spaceId: 'pgvector',
          dirName: '20250101000000_install_pgvector',
          migrationHash: 'm-ext',
          from: '0000',
          to: 'ext',
          operationsExecuted: 1,
        },
        {
          spaceId: 'app',
          dirName: '20250101000001_init',
          migrationHash: 'm-app',
          from: '0000',
          to: 'app',
          operationsExecuted: 3,
        },
      ],
      summary: 'Applied 4 operation(s) across 2 contract space(s)',
      perSpace: [
        {
          spaceId: 'pgvector',
          kind: 'extension',
          operations: [{ id: 'op1', label: 'Install vector ext', operationClass: 'additive' }],
          marker: { storageHash: 'ext' },
        },
        {
          spaceId: 'app',
          kind: 'app',
          operations: [
            { id: 'op2', label: 'Create user', operationClass: 'additive' },
            { id: 'op3', label: 'Create post', operationClass: 'additive' },
            { id: 'op4', label: 'Add fk', operationClass: 'additive' },
          ],
          marker: { storageHash: 'app' },
        },
      ],
      timings: { total: 42 },
    };
    expect(Object.keys(result).sort()).toMatchInlineSnapshot(`
      [
        "applied",
        "markerHash",
        "migrationsApplied",
        "migrationsTotal",
        "ok",
        "perSpace",
        "summary",
        "timings",
      ]
    `);
    expect(result.perSpace.map((p) => p.spaceId)).toEqual(['pgvector', 'app']);
  });

  it('pins per-space entry shape so per-space markers and ordering survive future refactors', () => {
    const entry: MigrateResult['perSpace'][number] = {
      spaceId: 'pgvector',
      kind: 'extension',
      operations: [{ id: 'op1', label: 'Install vector ext', operationClass: 'additive' }],
      marker: { storageHash: 'ext' },
    };
    expect(Object.keys(entry).sort()).toEqual(['kind', 'marker', 'operations', 'spaceId']);
    expect(entry.marker).toEqual({ storageHash: 'ext' });
  });
});

describe('MigrationStatusResult JSON shape', () => {
  it('matches expected keys for the list-shaped wire format', () => {
    const result: MigrationStatusResult = {
      ok: true,
      spaces: [
        {
          space: 'app',
          currentContract: 'marker',
          targetContract: 'leaf',
          migrations: [
            {
              name: '20260101T1200_init',
              hash: 'mid',
              fromContract: 'a',
              toContract: 'b',
              operationCount: 3,
              createdAt: '2026-01-01T00:00:00.000Z',
              refs: [],
              providedInvariants: [],
              status: 'applied',
            },
          ],
        },
      ],
      summary: 'up to date',
      diagnostics: [],
    };
    expect(Object.keys(result).sort()).toMatchInlineSnapshot(`
      [
        "diagnostics",
        "ok",
        "spaces",
        "summary",
      ]
    `);
    expect(Object.keys(result.spaces[0]!).sort()).toEqual([
      'currentContract',
      'migrations',
      'space',
      'targetContract',
    ]);
  });
});
