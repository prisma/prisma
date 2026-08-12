import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import type { PerSpaceExecutionEntry } from '../src/control-api/types';
import {
  formatMigrationApplyOutput,
  formatMigrationJson,
  formatMigrationPlanOutput,
  formatPerSpaceBlock,
  type MigrationCommandResult,
} from '../src/utils/formatters/migrations';
import { parseGlobalFlags } from '../src/utils/global-flags';

function createPlanResult(overrides?: Partial<MigrationCommandResult>): MigrationCommandResult {
  return {
    ok: true,
    mode: 'plan',
    plan: {
      targetId: 'postgres',
      destination: {
        storageHash: 'dest-hash',
        profileHash: 'dest-profile',
      },
      operations: [
        {
          id: 'column.user.nickname',
          label: 'Add column nickname on user',
          operationClass: 'additive',
        },
        {
          id: 'dropColumn.post.legacy',
          label: 'Drop column legacy on post',
          operationClass: 'destructive',
        },
      ],
    },
    summary: 'Planned 2 operation(s)',
    timings: { total: 42 },
    ...overrides,
  };
}

function createApplyResult(overrides?: Partial<MigrationCommandResult>): MigrationCommandResult {
  return {
    ok: true,
    mode: 'apply',
    plan: {
      targetId: 'postgres',
      destination: {
        storageHash: 'dest-hash',
      },
      operations: [
        {
          id: 'column.user.nickname',
          label: 'Add column nickname on user',
          operationClass: 'additive',
        },
      ],
    },
    execution: {
      operationsPlanned: 1,
      operationsExecuted: 1,
    },
    marker: {
      storageHash: 'dest-hash',
    },
    summary: 'Applied 1 operation(s), signature updated',
    timings: { total: 100 },
    ...overrides,
  };
}

describe('formatMigrationPlanOutput', () => {
  it('shows operation count and tree', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Planned 2 operation(s)');
    expect(stripped).toContain('Add column nickname on user');
    expect(stripped).toContain('Drop column legacy on post');
    // M6 (T6.6 / AC8): inline operationClass tags removed; destructive
    // ops keep a "(destructive)" marker on the same line.
    expect(stripped).not.toContain('[additive]');
    expect(stripped).not.toContain('[destructive]');
    expect(stripped).toContain('(destructive)');
  });

  it('shows destination hash', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('dest-hash');
  });

  it('shows dry run note', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('dry run');
    expect(stripped).toContain('Run without --dry-run');
  });

  it('shows tree characters', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('├');
    expect(stripped).toContain('└');
  });

  it('handles zero operations', () => {
    const result = createPlanResult({
      plan: { targetId: 'postgres', destination: { storageHash: 'same' }, operations: [] },
      summary: 'Planned 0 operation(s)',
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Planned 0 operation(s)');
    expect(stripped).not.toContain('├');
  });

  it('prints a Warnings block when planner warnings are present', () => {
    const result = createPlanResult({
      plan: { targetId: 'postgres', destination: { storageHash: 'same' }, operations: [] },
      summary: 'Planned 0 operation(s)',
      warnings: [
        {
          kind: 'controlPolicySuppressedCall',
          summary:
            "control policy suppressed: createTable(auth.users) — namespace 'auth' has effective control 'external' but table declared 'managed'",
        },
      ],
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));

    expect(stripped).toContain('Planned 0 operation(s)');
    expect(stripped).toContain('Warnings:');
    expect(stripped).toContain('control policy suppressed: createTable(auth.users)');
  });

  it('omits the Warnings block when warnings are absent', () => {
    const result = createPlanResult({
      plan: { targetId: 'postgres', destination: { storageHash: 'same' }, operations: [] },
      summary: 'Planned 0 operation(s)',
    });
    const stripped = stripAnsi(
      formatMigrationPlanOutput(result, parseGlobalFlags({ 'no-color': true })),
    );
    expect(stripped).not.toContain('Warnings:');
  });

  it('shows destructive warning when operations contain destructive class', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('⚠');
    expect(stripped).toContain('destructive operations');
    expect(stripped).toContain('data loss');
  });

  it('omits destructive warning when all operations are additive', () => {
    const result = createPlanResult({
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'dest-hash' },
        operations: [
          {
            id: 'column.user.nickname',
            label: 'Add column nickname on user',
            operationClass: 'additive',
          },
        ],
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).not.toContain('⚠');
    expect(stripped).not.toContain('data loss');
  });

  it('returns empty string in quiet mode', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ quiet: true });
    const output = formatMigrationPlanOutput(result, flags);

    expect(output).toBe('');
  });

  it('includes timings in verbose mode', () => {
    const result = createPlanResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const output = formatMigrationPlanOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Total time: 42ms');
  });

  it('shows planned ref advancement when plannedAdvanceRef is set', () => {
    const result = createPlanResult({
      plannedAdvanceRef: { name: 'db', hash: 'planned-hash' },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));

    expect(stripped).toContain('Would advance ref "db" → planned-hash');
  });

  it('omits planned ref advancement when plannedAdvanceRef is null', () => {
    const result = createPlanResult({ plannedAdvanceRef: null });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));

    expect(stripped).not.toContain('Would advance ref');
  });
});

describe('formatMigrationApplyOutput', () => {
  it('prints a Warnings block when planner warnings are present', () => {
    const result = createApplyResult({
      execution: { operationsPlanned: 0, operationsExecuted: 0 },
      summary: 'Database already matches contract',
      warnings: [
        {
          kind: 'controlPolicySuppressedCall',
          summary:
            "control policy suppressed: createTable(auth.users) — namespace 'auth' has effective control 'external' but table declared 'managed'",
        },
      ],
    });
    const stripped = stripAnsi(
      formatMigrationApplyOutput(result, parseGlobalFlags({ 'no-color': true })),
    );
    expect(stripped).toContain('Warnings:');
    expect(stripped).toContain('control policy suppressed: createTable(auth.users)');
  });

  it('shows executed operation count', () => {
    const result = createApplyResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Applied 1 operation(s)');
  });

  it('shows marker hash', () => {
    const result = createApplyResult();
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyOutput(result, flags);
    const stripped = stripAnsi(output);

    // M6 (T6.5 / AC4): single-line `Signature:` is replaced. When the
    // result carries no per-space breakdown we fall back to a labelled
    // `App-space marker:` line that names what the hash covers; the
    // across-spaces block lives in the per-space output (see other tests).
    expect(stripped).toContain('App-space marker: dest-hash');
    expect(stripped).not.toContain('Signature: dest-hash');
  });

  it('shows profile hash when present', () => {
    const result = createApplyResult({
      marker: {
        storageHash: 'dest-hash',
        profileHash: 'dest-profile',
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Profile hash: dest-profile');
  });

  it('returns empty string in quiet mode', () => {
    const result = createApplyResult();
    const flags = parseGlobalFlags({ quiet: true });
    const output = formatMigrationApplyOutput(result, flags);

    expect(output).toBe('');
  });

  it('includes timings in verbose mode', () => {
    const result = createApplyResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });
    const output = formatMigrationApplyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Total time: 100ms');
  });

  describe('per-space breakdown (M6 AC4 / AC5)', () => {
    const perSpace: ReadonlyArray<PerSpaceExecutionEntry> = [
      {
        spaceId: 'pgvector',
        kind: 'extension',
        operations: [
          {
            id: 'pgvector.install-vector-extension',
            label: 'Install vector extension',
            operationClass: 'additive',
          },
        ],
        marker: { storageHash: 'pgvector-head' },
      },
      {
        spaceId: 'app',
        kind: 'app',
        operations: [
          {
            id: 'table.embeddings',
            label: 'Create table embeddings',
            operationClass: 'additive',
          },
        ],
        marker: { storageHash: 'app-head' },
      },
    ];

    it('renders the extension space first then the app space (canonical order)', () => {
      const lines = formatPerSpaceBlock(perSpace, 'apply', false);
      const block = lines.join('\n');
      const extensionIdx = block.indexOf('Extension space: pgvector');
      const appIdx = block.indexOf('App space');
      expect(extensionIdx).toBeGreaterThanOrEqual(0);
      expect(appIdx).toBeGreaterThan(extensionIdx);
    });

    it('surfaces every per-space marker on apply (AC4)', () => {
      const block = formatPerSpaceBlock(perSpace, 'apply', false).join('\n');
      expect(block).toContain('marker: pgvector-head');
      expect(block).toContain('marker: app-head');
    });

    it('omits per-space markers in plan mode (no marker yet)', () => {
      const block = formatPerSpaceBlock(perSpace, 'plan', false).join('\n');
      expect(block).not.toContain('marker:');
    });

    it('formatMigrationApplyOutput uses the per-space block in place of the legacy `Signature:` line when perSpace is present', () => {
      const result = createApplyResult({
        execution: { operationsPlanned: 2, operationsExecuted: 2 },
        marker: { storageHash: 'app-head' },
        perSpace,
        summary: 'Applied 2 operation(s) across 2 space(s), database signed',
      });
      const flags = parseGlobalFlags({ 'no-color': true });
      const stripped = stripAnsi(formatMigrationApplyOutput(result, flags));

      expect(stripped).toContain('Applied 2 operation(s) across 2 contract spaces');
      expect(stripped).toContain('Extension space: pgvector');
      expect(stripped).toContain('App space');
      expect(stripped).toContain('marker: pgvector-head');
      expect(stripped).toContain('marker: app-head');
      // Legacy single-line signature must not reappear.
      expect(stripped).not.toContain('Signature:');
      // Next-step hint surfaces the canonical follow-up command (AC6).
      expect(stripped).toContain("Run 'prisma-next migration status'");
    });
  });

  it('shows no-op message when zero operations executed', () => {
    const result = createApplyResult({
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'same' },
        operations: [],
      },
      execution: { operationsPlanned: 0, operationsExecuted: 0 },
      marker: { storageHash: 'same' },
      summary: 'Database already matches contract, signature updated',
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const output = formatMigrationApplyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Database already matches contract');
    expect(stripped).not.toContain('Applied 0');
  });

  it('shows advanced ref when advancedRef is set', () => {
    const result = createApplyResult({
      advancedRef: { name: 'db', hash: 'applied-hash' },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationApplyOutput(result, flags));

    expect(stripped).toContain('Advanced ref "db" → applied-hash');
  });

  it('omits advanced ref line when advancedRef is null', () => {
    const result = createApplyResult({ advancedRef: null });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationApplyOutput(result, flags));

    expect(stripped).not.toContain('Advanced ref');
  });
});

describe('formatMigrationJson', () => {
  it('returns valid parseable JSON', () => {
    const result = createPlanResult();
    const output = formatMigrationJson(result);

    expect(() => JSON.parse(output)).not.toThrow();
  });

  it('includes all plan fields in JSON output', () => {
    const result = createPlanResult();
    const output = formatMigrationJson(result);
    const parsed = JSON.parse(output) as MigrationCommandResult;

    expect(parsed).toMatchObject({
      ok: true,
      mode: 'plan',
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'dest-hash' },
        operations: expect.arrayContaining([
          expect.objectContaining({ id: 'column.user.nickname', operationClass: 'additive' }),
        ]),
      },
      summary: 'Planned 2 operation(s)',
    });
  });

  it('does not include origin in JSON output', () => {
    const result = createPlanResult();
    const output = formatMigrationJson(result);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    expect(parsed).not.toHaveProperty('origin');
  });

  it('includes execution and marker fields in apply JSON output', () => {
    const result = createApplyResult();
    const output = formatMigrationJson(result);
    const parsed = JSON.parse(output) as MigrationCommandResult;

    expect(parsed).toMatchObject({
      ok: true,
      mode: 'apply',
      execution: { operationsPlanned: 1, operationsExecuted: 1 },
      marker: { storageHash: 'dest-hash' },
    });
  });

  it('includes plannedAdvanceRef in plan JSON output when set', () => {
    const result = createPlanResult({
      plannedAdvanceRef: { name: 'staging', hash: 'planned-hash' },
    });
    const parsed = JSON.parse(formatMigrationJson(result)) as MigrationCommandResult;

    expect(parsed.plannedAdvanceRef).toEqual({ name: 'staging', hash: 'planned-hash' });
    expect(parsed.advancedRef).toBeUndefined();
  });

  it('includes advancedRef in apply JSON output when set', () => {
    const result = createApplyResult({
      advancedRef: { name: 'db', hash: 'applied-hash' },
    });
    const parsed = JSON.parse(formatMigrationJson(result)) as MigrationCommandResult;

    expect(parsed.advancedRef).toEqual({ name: 'db', hash: 'applied-hash' });
    expect(parsed.plannedAdvanceRef).toBeUndefined();
  });

  it('serializes null ref advancement fields in JSON output', () => {
    const result = createApplyResult({ advancedRef: null, plannedAdvanceRef: null });
    const parsed = JSON.parse(formatMigrationJson(result)) as MigrationCommandResult;

    expect(parsed.advancedRef).toBeNull();
    expect(parsed.plannedAdvanceRef).toBeNull();
  });

  it('uses 2-space indentation', () => {
    const result = createPlanResult();
    const output = formatMigrationJson(result);
    const lines = output.split('\n');

    expect(lines[1]).toMatch(/^ {2}"/);
  });
});

describe('formatMigrationPlanOutput — preview block rendering', () => {
  // Byte-identity bar from spec § A9 / OQ-4: SQL output must be unchanged from
  // the pre-M3 `sql: string[]` rendering. The legacy renderer trimmed each
  // statement and appended `;` if missing, one statement per line under the
  // `DDL preview` header. SQL-only previews continue to use that header label;
  // any non-SQL preview switches to a family-agnostic `Operation preview`.
  it('renders SQL statements identically to the legacy `sql[]` rendering', () => {
    const result = createPlanResult({
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'dest-hash' },
        operations: [{ id: 'op1', label: 'op1', operationClass: 'additive' }],
        preview: {
          statements: [
            { text: 'CREATE TABLE "user" (id int4 NOT NULL)', language: 'sql' },
            { text: 'ALTER TABLE "post" ADD COLUMN name text;', language: 'sql' },
          ],
        },
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));
    expect(stripped).toContain('DDL preview');
    // Byte-identity bar: assert exact ordered DDL line shape, not just
    // substring presence. `toContain` would silently accept format drifts (e.g.
    // missing trailing `;`, doubled `;`, reordered statements, additional
    // injected lines).
    const ddlLines = stripped
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('CREATE ') || line.startsWith('ALTER '));
    expect(ddlLines).toEqual([
      'CREATE TABLE "user" (id int4 NOT NULL);',
      'ALTER TABLE "post" ADD COLUMN name text;',
    ]);
  });

  it('uses an `Operation preview` header and renders `mongodb-shell` statements verbatim without trailing `;`', () => {
    const result = createPlanResult({
      plan: {
        targetId: 'mongo',
        destination: { storageHash: 'dest-hash' },
        operations: [{ id: 'op1', label: 'op1', operationClass: 'additive' }],
        preview: {
          statements: [
            {
              text: 'db.users.createIndex({ "email": 1 }, { unique: true })',
              language: 'mongodb-shell',
            },
            { text: 'db.users.dropIndex("email_1")', language: 'mongodb-shell' },
          ],
        },
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));
    expect(stripped).toContain('Operation preview');
    expect(stripped).not.toContain('DDL preview');
    expect(stripped).toContain('db.users.createIndex({ "email": 1 }, { unique: true })');
    expect(stripped).toContain('db.users.dropIndex("email_1")');
    // Mongo shell lines must not be suffixed with `;`.
    expect(stripped).not.toContain('createIndex({ "email": 1 }, { unique: true });');
  });

  it('uses an `Operation preview` header for an empty preview, not `DDL preview`', () => {
    // `Array.prototype.every` is vacuously true on empty arrays. Without
    // explicitly guarding on length, an empty preview would be misclassified
    // as SQL-only and rendered with the SQL-specific `DDL preview` header.
    // Default the empty case to the family-agnostic label.
    const result = createPlanResult({
      plan: {
        targetId: 'postgres',
        destination: { storageHash: 'dest-hash' },
        operations: [],
        preview: { statements: [] },
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });
    const stripped = stripAnsi(formatMigrationPlanOutput(result, flags));
    expect(stripped).toContain('Operation preview');
    expect(stripped).not.toContain('DDL preview');
  });
});
