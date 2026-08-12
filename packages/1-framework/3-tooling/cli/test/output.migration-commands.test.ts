import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import { formatMigrationApplyCommandOutput } from '../src/utils/formatters/migrations';
import { parseGlobalFlags } from '../src/utils/global-flags';

describe('formatMigrationApplyCommandOutput', () => {
  it('formats no-op apply (no spaces had pending operations)', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyCommandOutput(
      {
        migrationsApplied: 0,
        markerHash: 'marker',
        applied: [],
        summary: 'Already up to date across 1 space(s)',
        perSpace: [],
      },
      flags,
    );

    const stripped = stripAnsi(output);
    expect(stripped).toContain('Already up to date');
    // No-op apply still mentions the canonical next-step hint so the
    // user knows where to verify state.
    expect(stripped).toContain('Next: prisma-next migration status');
  });

  it('renders the per-space block with markers in canonical schedule order', () => {
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyCommandOutput(
      {
        migrationsApplied: 2,
        markerHash: 'app-marker',
        applied: [
          { spaceId: 'pgvector', operationsExecuted: 1 },
          { spaceId: 'app', operationsExecuted: 1 },
        ],
        summary: 'Applied 2 operation(s) across 2 contract space(s)',
        perSpace: [
          {
            spaceId: 'pgvector',
            kind: 'extension',
            operations: [{ id: 'op-vec', label: 'Install vector ext', operationClass: 'additive' }],
            marker: { storageHash: 'ext' },
          },
          {
            spaceId: 'app',
            kind: 'app',
            operations: [{ id: 'op-user', label: 'Create user', operationClass: 'additive' }],
            marker: { storageHash: 'app-marker' },
          },
        ],
      },
      flags,
    );

    const stripped = stripAnsi(output);
    // Top line names the cross-space totals (operation count + space count).
    expect(stripped).toContain('Applied 2 operation(s) across 2 contract space(s)');
    // Both spaces are observable, in canonical order (extension first).
    const extensionIdx = stripped.indexOf('pgvector');
    const appIdx = stripped.indexOf('App space');
    expect(extensionIdx).toBeGreaterThanOrEqual(0);
    expect(appIdx).toBeGreaterThan(extensionIdx);
    // Per-space markers are observable so consumers can confirm each
    // space landed on the expected hash.
    expect(stripped).toContain('ext');
    expect(stripped).toContain('app-marker');
  });

  it('includes total timing in verbose mode', () => {
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const output = formatMigrationApplyCommandOutput(
      {
        migrationsApplied: 1,
        markerHash: 'marker',
        applied: [{ spaceId: 'app', operationsExecuted: 1 }],
        summary: 'Applied 1 operation(s) across 1 contract space(s)',
        perSpace: [
          {
            spaceId: 'app',
            kind: 'app',
            operations: [{ id: 'op-user', label: 'Create user', operationClass: 'additive' }],
            marker: { storageHash: 'marker' },
          },
        ],
        timings: { total: 42 },
      },
      flags,
    );

    expect(stripAnsi(output)).toContain('Total time: 42ms');
  });
});
