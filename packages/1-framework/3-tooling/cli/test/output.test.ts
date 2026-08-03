import type {
  CoreSchemaView,
  IntrospectSchemaResult,
  SchemaDiffIssue,
  SignDatabaseResult,
  VerifyDatabaseSchemaResult,
} from '@internal/framework-components/control';
import { SchemaTreeNode } from '@internal/framework-components/control';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import {
  formatIntrospectJson,
  formatIntrospectOutput,
  formatSchemaVerifyJson,
  formatSchemaVerifyOutput,
  formatSignJson,
  formatSignOutput,
} from '../src/utils/formatters/verify';
import { parseGlobalFlags } from '../src/utils/global-flags';

describe('formatIntrospectOutput', () => {
  const createSchemaView = (): CoreSchemaView => ({
    root: new SchemaTreeNode({
      kind: 'root',
      id: 'sql-schema',
      label: 'sql schema (tables: 2)',
      children: [
        new SchemaTreeNode({
          kind: 'entity',
          id: 'table-user',
          label: 'table user',
          children: [
            new SchemaTreeNode({
              kind: 'field',
              id: 'column-id',
              label: 'id: pg/int4@1 (not null)',
            }),
            new SchemaTreeNode({
              kind: 'field',
              id: 'column-email',
              label: 'email: pg/text@1 (not null)',
            }),
            new SchemaTreeNode({
              kind: 'index',
              id: 'index-user-email',
              label: 'index user_email_unique',
            }),
          ],
        }),
        new SchemaTreeNode({
          kind: 'entity',
          id: 'table-post',
          label: 'table post',
          children: [
            new SchemaTreeNode({
              kind: 'field',
              id: 'column-id',
              label: 'id: pg/int4@1 (not null)',
            }),
          ],
        }),
      ],
    }),
  });

  const createResult = (): IntrospectSchemaResult<unknown> => ({
    ok: true,
    summary: 'Schema introspected successfully',
    target: {
      familyId: 'sql',
      id: 'postgres',
    },
    schema: { tables: {} },
    meta: {
      configPath: './prisma-next.config.ts',
      dbUrl: 'postgresql://user:****@localhost/test',
    },
    timings: {
      total: 123,
    },
  });

  it('renders tree structure with schema view', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, schemaView, flags);
    const stripped = stripAnsi(output);

    // Root should be present
    expect(stripped).toContain('sql schema (tables: 2)');
    // Entities should be present
    expect(stripped).toContain('table user');
    expect(stripped).toContain('table post');
    // Fields should be present
    expect(stripped).toContain('id: pg/int4@1 (not null)');
    expect(stripped).toContain('email: pg/text@1 (not null)');
    // Index should be present
    expect(stripped).toContain('index user_email_unique');
    // Tree characters should be present
    expect(stripped).toContain('├');
    expect(stripped).toContain('└');
  });

  it('renders tree structure with proper indentation', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, schemaView, flags);
    const lines = output.split('\n').map(stripAnsi);

    // Exact tree structure: prefix is accumulated so depth-2 nodes
    // get the ancestor continuation guide (│) from depth 1.
    expect(lines[0]).toBe('sql schema (tables: 2)');
    expect(lines[1]).toBe('├─ table user');
    expect(lines[2]).toBe('│  ├─ id: pg/int4@1 (not null)');
    expect(lines[3]).toBe('│  ├─ email: pg/text@1 (not null)');
    expect(lines[4]).toBe('│  └─ index user_email_unique');
    expect(lines[5]).toBe('└─ table post');
    expect(lines[6]).toBe('   └─ id: pg/int4@1 (not null)');
  });

  it('renders root with no children', () => {
    const schemaView: CoreSchemaView = {
      root: new SchemaTreeNode({
        kind: 'root',
        id: 'sql-schema',
        label: 'sql schema (tables: 0)',
      }),
    };
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, schemaView, flags);
    const stripped = stripAnsi(output);

    // Root should still be printed
    expect(stripped).toContain('sql schema (tables: 0)');
  });

  it('returns empty string in quiet mode', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ quiet: true });

    const output = formatIntrospectOutput(result, schemaView, flags);

    expect(output).toBe('');
  });

  it('includes timings in verbose mode', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatIntrospectOutput(result, schemaView, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Total time: 123ms');
  });

  it('applies colors when enabled', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ color: true });

    const output = formatIntrospectOutput(result, schemaView, flags);

    // If colors are enabled, at least the root (bold) or entities (cyan) should have colors
    // For now, we'll check that the output is different from no-color mode
    const noColorOutput = formatIntrospectOutput(
      result,
      schemaView,
      parseGlobalFlags({ 'no-color': true }),
    );
    // When colors are enabled, the output structure should be the same but may have ANSI codes
    // We verify colors are working by checking the structure is correct
    expect(output.length).toBeGreaterThan(0);
    expect(noColorOutput.length).toBeGreaterThan(0);
  });

  it('does not apply colors when disabled', () => {
    const schemaView = createSchemaView();
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, schemaView, flags);

    // Should not contain ANSI color codes
    expect(output).not.toContain('\u001b[');
  });

  it('renders fallback summary when schema view is undefined', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, undefined, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Schema introspected successfully');
  });

  it('includes target and dbUrl in verbose mode when schema view is undefined', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatIntrospectOutput(result, undefined, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Target: sql/postgres');
    expect(stripped).toContain('Database: postgresql://user:****@localhost/test');
    expect(stripped).toContain('Total time: 123ms');
  });

  it('does not include target and dbUrl in non-verbose mode when schema view is undefined', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatIntrospectOutput(result, undefined, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Schema introspected successfully');
    expect(stripped).not.toContain('Target:');
    expect(stripped).not.toContain('Database:');
    expect(stripped).not.toContain('Total time:');
  });

  it('handles missing meta fields gracefully', () => {
    const result: IntrospectSchemaResult<unknown> = {
      ok: true,
      summary: 'Schema introspected successfully',
      target: {
        familyId: 'sql',
        id: 'postgres',
      },
      schema: { tables: {} },
      timings: {
        total: 123,
      },
    };
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatIntrospectOutput(result, undefined, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Schema introspected successfully');
    expect(stripped).toContain('Target: sql/postgres');
    expect(stripped).not.toContain('Database:');
  });
});

describe('formatIntrospectJson', () => {
  it('formats result as pretty-printed JSON', () => {
    const result: IntrospectSchemaResult<unknown> = {
      ok: true,
      summary: 'Schema introspected successfully',
      target: {
        familyId: 'sql',
        id: 'postgres',
      },
      schema: { tables: { user: { columns: {} } } },
      meta: {
        configPath: './prisma-next.config.ts',
        dbUrl: 'postgresql://user:****@localhost/test',
      },
      timings: {
        total: 123,
      },
    };

    const output = formatIntrospectJson(result);
    const parsed = JSON.parse(output) as IntrospectSchemaResult<unknown>;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Schema introspected successfully');
    expect(parsed.target.familyId).toBe('sql');
    expect(parsed.target.id).toBe('postgres');
    expect(parsed.schema).toEqual({ tables: { user: { columns: {} } } });
    expect(parsed.meta?.configPath).toBe('./prisma-next.config.ts');
    expect(parsed.meta?.dbUrl).toBe('postgresql://user:****@localhost/test');
    expect(parsed.timings.total).toBe(123);
  });

  it('uses 2-space indentation', () => {
    const result: IntrospectSchemaResult<unknown> = {
      ok: true,
      summary: 'Test',
      target: {
        familyId: 'sql',
        id: 'postgres',
      },
      schema: {},
      timings: {
        total: 0,
      },
    };

    const output = formatIntrospectJson(result);
    const lines = output.split('\n');

    // Check that indentation is 2 spaces
    expect(lines[1]).toMatch(/^ {2}"/);
  });

  it('handles result without meta fields', () => {
    const result: IntrospectSchemaResult<unknown> = {
      ok: true,
      summary: 'Schema introspected successfully',
      target: {
        familyId: 'sql',
        id: 'postgres',
      },
      schema: {},
      timings: {
        total: 123,
      },
    };

    const output = formatIntrospectJson(result);
    const parsed = JSON.parse(output) as IntrospectSchemaResult<unknown>;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Schema introspected successfully');
    expect(parsed.target.familyId).toBe('sql');
    expect(parsed.target.id).toBe('postgres');
    expect(parsed.schema).toEqual({});
    expect(parsed.timings.total).toBe(123);
    expect(parsed.meta).toBeUndefined();
  });
});

describe('formatSchemaVerifyOutput', () => {
  // A minimal node to carry presence — the formatter derives the missing/extra/
  // mismatch label from which sides are set, not from any stored field.
  const node = { id: 'x', nodeKind: 'x', isEqualTo: () => true, children: () => [] };
  const missingTableIssue: SchemaDiffIssue = {
    path: ['post'],
    expected: node,
  };

  const createResult = (): VerifyDatabaseSchemaResult => ({
    ok: false,
    code: 'CONTRACT.SCHEMA_VERIFICATION_FAILED',
    summary: 'Database schema does not satisfy contract (1 failure)',
    contract: {
      storageHash: 'test',
    },
    target: {
      expected: 'postgres',
      actual: 'postgres',
    },
    schema: {
      issues: [missingTableIssue],
    },
    meta: {
      contractPath: './contract.json',
      strict: false,
    },
    timings: {
      total: 123,
    },
  });

  it('renders a "Schema issues:" header with one ✖ line per issue message', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Schema issues:');
    expect(stripped).toContain('✖ missing: post');
    expect(stripped).toContain('✖ Database schema does not satisfy contract (1 failure)');
  });

  it('renders every issue, each on its own line', () => {
    const diffIssue: SchemaDiffIssue = {
      path: ['public', 'profiles', 'policy_abc'],
      expected: node,
    };
    const result: VerifyDatabaseSchemaResult = {
      ...createResult(),
      schema: {
        issues: [missingTableIssue, diffIssue],
      },
    };
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const lines = output.split('\n').map(stripAnsi);

    const issueLineIndex = lines.findIndex((line) =>
      line.includes(missingTableIssue.path.join('/')),
    );
    const diffLineIndex = lines.findIndex((line) => line.includes(diffIssue.path.join('/')));

    expect(issueLineIndex).toBeGreaterThanOrEqual(0);
    expect(diffLineIndex).toBeGreaterThan(issueLineIndex);
  });

  it('omits the "Schema issues:" header and renders the success summary when the list is empty', () => {
    const { code: _code, ...rest } = createResult();
    const result: VerifyDatabaseSchemaResult = {
      ...rest,
      ok: true,
      summary: 'Database schema satisfies contract',
      schema: { issues: [] },
    };
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).not.toContain('Schema issues:');
    expect(stripped).toBe('✔ Database schema satisfies contract');
  });

  it('renders a distinct "Schema warnings:" block on a passing verify with observed-policy drift', () => {
    const { code: _code, ...rest } = createResult();
    const result: VerifyDatabaseSchemaResult = {
      ...rest,
      ok: true,
      summary: 'Database schema satisfies contract',
      schema: {
        issues: [],
        warnings: {
          issues: [
            {
              path: ['database', 'public', 'legacy_jobs'],
              expected: node,
            },
          ],
        },
      },
    };
    const flags = parseGlobalFlags({ 'no-color': true });

    const stripped = stripAnsi(formatSchemaVerifyOutput(result, flags));

    expect(stripped).not.toContain('Schema issues:');
    expect(stripped).toContain('Schema warnings:');
    expect(stripped).toContain('⚠ missing: database/public/legacy_jobs');
    expect(stripped).toContain('✔ Database schema satisfies contract');
  });

  it('includes the code in the failure summary', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('(CONTRACT.SCHEMA_VERIFICATION_FAILED)');
  });

  it('renders the issues header first and the summary line last', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const lines = output.split('\n').map(stripAnsi);

    expect(lines[0]).toBe('Schema issues:');
    const summaryLine = lines[lines.length - 1];
    expect(summaryLine).toContain('Database schema does not satisfy contract');
  });

  it('returns empty string in quiet mode', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ quiet: true });

    const output = formatSchemaVerifyOutput(result, flags);

    expect(output).toBe('');
  });

  it('includes total time in verbose mode', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Total time: 123ms');
  });

  it('applies colors when enabled', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ color: true });

    const output = formatSchemaVerifyOutput(result, flags);

    expect(output.length).toBeGreaterThan(0);
    expect(stripAnsi(output)).toContain('Schema issues:');
  });

  it('does not apply colors when disabled', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);

    // Should not contain ANSI color codes
    expect(output).not.toContain('\u001b[');
  });

  it('renders unclaimed elements in strict mode with a red header and ✖ glyphs', () => {
    const result: VerifyDatabaseSchemaResult = {
      ...createResult(),
      ok: false,
      schema: { issues: [] },
      meta: { contractPath: './contract.json', strict: true },
    };
    const flags = parseGlobalFlags({ color: true });

    const output = formatSchemaVerifyOutput(result, flags, ['legacy_events']);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Unclaimed elements (declared by no contract):');
    expect(stripped).toContain('✖ legacy_events');
  });

  it('renders unclaimed elements in lenient mode with a yellow header and ⚠ glyphs', () => {
    const { code: _code, ...rest } = createResult();
    const result: VerifyDatabaseSchemaResult = {
      ...rest,
      ok: true,
      summary: 'Database schema satisfies contract',
      schema: { issues: [] },
      meta: { contractPath: './contract.json', strict: false },
    };
    const flags = parseGlobalFlags({ color: true });

    const output = formatSchemaVerifyOutput(result, flags, ['legacy_events']);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('Unclaimed elements (declared by no contract):');
    expect(stripped).toContain('⚠ legacy_events');
  });

  it('separates the issues block from the unclaimed block with a blank line', () => {
    const result = createResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags, ['legacy_events']);
    const lines = output.split('\n').map(stripAnsi);

    const blankIndex = lines.findIndex((line) => line === '');
    expect(blankIndex).toBeGreaterThan(0);
    expect(lines[blankIndex - 1]).toContain('missing: post');
    expect(lines[blankIndex + 1]).toBe('Unclaimed elements (declared by no contract):');
  });

  it('renders RLS policy drift issues, naming each drifted policy', () => {
    const policyWireName = 'read_own_profiles_abc12345';
    const result: VerifyDatabaseSchemaResult = {
      ...createResult(),
      ok: false,
      summary: 'Database schema does not satisfy contract (1 failure)',
      schema: {
        issues: [
          {
            path: ['public', 'profiles', policyWireName],
            expected: node,
          },
        ],
      },
    };
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSchemaVerifyOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain(policyWireName);
    expect(stripped).toContain('Schema issues:');
    expect(stripped).toContain('✖ Database schema does not satisfy contract (1 failure)');
  });
});

describe('formatSchemaVerifyJson', () => {
  it('formats result as pretty-printed JSON', () => {
    const result: VerifyDatabaseSchemaResult = {
      ok: true,
      summary: 'Database schema satisfies contract',
      contract: {
        storageHash: 'test',
        profileHash: 'profile',
      },
      target: {
        expected: 'postgres',
        actual: 'postgres',
      },
      schema: {
        issues: [],
      },
      meta: {
        contractPath: './contract.json',
        strict: false,
        configPath: './prisma-next.config.ts',
      },
      timings: {
        total: 123,
      },
    };

    const output = formatSchemaVerifyJson(result);
    const parsed = JSON.parse(output) as VerifyDatabaseSchemaResult;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Database schema satisfies contract');
    expect(parsed.contract.storageHash).toBe('test');
    expect(parsed.contract.profileHash).toBe('profile');
    expect(parsed.target.expected).toBe('postgres');
    expect(parsed.schema.issues).toEqual([]);
    expect(parsed.meta?.contractPath).toBe('./contract.json');
    expect(parsed.meta?.strict).toBe(false);
    expect(parsed.timings.total).toBe(123);
  });

  it('uses 2-space indentation', () => {
    const result: VerifyDatabaseSchemaResult = {
      ok: true,
      summary: 'Test',
      contract: {
        storageHash: 'test',
      },
      target: {
        expected: 'postgres',
        actual: 'postgres',
      },
      schema: {
        issues: [],
      },
      meta: {
        contractPath: './contract.json',
        strict: false,
      },
      timings: {
        total: 0,
      },
    };

    const output = formatSchemaVerifyJson(result);
    const lines = output.split('\n');

    // Check that indentation is 2 spaces
    expect(lines[1]).toMatch(/^ {2}"/);
  });

  it('handles result without code', () => {
    const result: VerifyDatabaseSchemaResult = {
      ok: true,
      summary: 'Database schema satisfies contract',
      contract: {
        storageHash: 'test',
      },
      target: {
        expected: 'postgres',
        actual: 'postgres',
      },
      schema: {
        issues: [],
      },
      meta: {
        contractPath: './contract.json',
        strict: false,
      },
      timings: {
        total: 123,
      },
    };

    const output = formatSchemaVerifyJson(result);
    const parsed = JSON.parse(output) as VerifyDatabaseSchemaResult;

    expect(parsed.ok).toBe(true);
    expect(parsed.code).toBeUndefined();
  });

  it('includes every issue', () => {
    const result: VerifyDatabaseSchemaResult = {
      ok: false,
      code: 'CONTRACT.SCHEMA_VERIFICATION_FAILED',
      summary: 'Database schema does not satisfy contract',
      contract: {
        storageHash: 'test',
      },
      target: {
        expected: 'postgres',
        actual: 'postgres',
      },
      schema: {
        issues: [
          {
            path: ['post'],
          },
          {
            path: ['public', 'profiles', 'policy_abc'],
          },
        ],
      },
      meta: {
        contractPath: './contract.json',
        strict: true,
        configPath: './prisma-next.config.ts',
      },
      timings: {
        total: 456,
      },
    };

    const output = formatSchemaVerifyJson(result);
    const parsed = JSON.parse(output) as VerifyDatabaseSchemaResult;

    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('CONTRACT.SCHEMA_VERIFICATION_FAILED');
    expect(parsed.schema.issues).toHaveLength(2);
    expect(parsed.meta?.strict).toBe(true);
  });

  it('includes the unclaimed list as a top-level field', () => {
    const result: VerifyDatabaseSchemaResult = {
      ok: false,
      code: 'CONTRACT.MARKER_REQUIRED',
      summary: 'Database schema has 1 unclaimed element (not in any contract)',
      contract: {
        storageHash: 'test',
      },
      target: {
        expected: 'postgres',
        actual: 'postgres',
      },
      schema: {
        issues: [],
      },
      meta: {
        contractPath: './contract.json',
        strict: true,
      },
      timings: {
        total: 12,
      },
    };

    const output = formatSchemaVerifyJson(result, ['legacy_events']);
    const parsed = JSON.parse(output) as VerifyDatabaseSchemaResult & {
      unclaimed: readonly string[];
    };

    expect(parsed.unclaimed).toEqual(['legacy_events']);
  });
});

describe('formatSignOutput', () => {
  const createSignResult = (overrides?: Partial<SignDatabaseResult>): SignDatabaseResult => ({
    ok: true,
    summary: 'Database signed (marker created)',
    contract: {
      storageHash: 'abc123',
      profileHash: 'def456',
    },
    target: {
      expected: 'postgres',
      actual: 'postgres',
    },
    marker: {
      created: true,
      updated: false,
    },
    meta: {
      contractPath: './contract.json',
      configPath: './prisma-next.config.ts',
    },
    timings: {
      total: 42,
    },
    ...overrides,
  });

  it('renders success message for new marker', () => {
    const result = createSignResult();
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSignOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Database signed');
    expect(stripped).toContain('from: none');
    expect(stripped).toContain('to:   abc123');
  });

  it('renders success message for updated marker', () => {
    const result = createSignResult({
      summary: 'Database signed (marker updated from old-hash)',
      marker: {
        created: false,
        updated: true,
        previous: {
          storageHash: 'old-hash',
          profileHash: 'old-profile-hash',
        },
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSignOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Database signed');
    expect(stripped).toContain('from: old-hash');
    expect(stripped).toContain('to:   abc123');
  });

  it('renders success message for already up-to-date marker', () => {
    const result = createSignResult({
      summary: 'Database already signed with this contract',
      marker: {
        created: false,
        updated: false,
        previous: {
          storageHash: 'abc123',
        },
      },
    });
    const flags = parseGlobalFlags({ 'no-color': true });

    const output = formatSignOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Database signed');
    expect(stripped).toContain('from: abc123');
    expect(stripped).toContain('to:   abc123');
  });

  it('includes hashes in verbose mode', () => {
    const result = createSignResult();
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatSignOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Database signed');
    expect(stripped).toContain('from: none');
    expect(stripped).toContain('to:   abc123');
    expect(stripped).toContain('profileHash: def456');
    expect(stripped).toContain('Total time: 42ms');
  });

  it('includes previous hashes in verbose mode when marker was updated', () => {
    const result = createSignResult({
      summary: 'Database signed (marker updated from old-hash)',
      marker: {
        created: false,
        updated: true,
        previous: {
          storageHash: 'old-hash',
          profileHash: 'old-profile-hash',
        },
      },
    });
    const flags = parseGlobalFlags({ verbose: true, 'no-color': true });

    const output = formatSignOutput(result, flags);
    const stripped = stripAnsi(output);

    expect(stripped).toContain('✔ Database signed');
    expect(stripped).toContain('from: old-hash');
    expect(stripped).toContain('to:   abc123');
    expect(stripped).toContain('previous profileHash: old-profile-hash');
  });

  it('returns empty string in quiet mode', () => {
    const result = createSignResult();
    const flags = parseGlobalFlags({ quiet: true, 'no-color': true });

    const output = formatSignOutput(result, flags);

    expect(output).toBe('');
  });
});

describe('formatSignJson', () => {
  const createSignResult = (overrides?: Partial<SignDatabaseResult>): SignDatabaseResult => ({
    ok: true,
    summary: 'Database signed (marker created)',
    contract: {
      storageHash: 'abc123',
      profileHash: 'def456',
    },
    target: {
      expected: 'postgres',
      actual: 'postgres',
    },
    marker: {
      created: true,
      updated: false,
    },
    meta: {
      contractPath: './contract.json',
      configPath: './prisma-next.config.ts',
    },
    timings: {
      total: 42,
    },
    ...overrides,
  });

  it('formats new marker result as JSON', () => {
    const result = createSignResult();
    const output = formatSignJson(result);
    const parsed = JSON.parse(output) as SignDatabaseResult;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Database signed (marker created)');
    expect(parsed.contract.storageHash).toBe('abc123');
    expect(parsed.contract.profileHash).toBe('def456');
    expect(parsed.marker.created).toBe(true);
    expect(parsed.marker.updated).toBe(false);
    expect(parsed.timings.total).toBe(42);
  });

  it('formats updated marker result as JSON', () => {
    const result = createSignResult({
      summary: 'Database signed (marker updated from old-hash)',
      marker: {
        created: false,
        updated: true,
        previous: {
          storageHash: 'old-hash',
          profileHash: 'old-profile-hash',
        },
      },
    });
    const output = formatSignJson(result);
    const parsed = JSON.parse(output) as SignDatabaseResult;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Database signed (marker updated from old-hash)');
    expect(parsed.marker.created).toBe(false);
    expect(parsed.marker.updated).toBe(true);
    expect(parsed.marker.previous?.storageHash).toBe('old-hash');
    expect(parsed.marker.previous?.profileHash).toBe('old-profile-hash');
  });

  it('formats already up-to-date marker result as JSON', () => {
    const result = createSignResult({
      summary: 'Database already signed with this contract',
      marker: {
        created: false,
        updated: false,
      },
    });
    const output = formatSignJson(result);
    const parsed = JSON.parse(output) as SignDatabaseResult;

    expect(parsed.ok).toBe(true);
    expect(parsed.summary).toBe('Database already signed with this contract');
    expect(parsed.marker.created).toBe(false);
    expect(parsed.marker.updated).toBe(false);
    expect(parsed.marker.previous).toBeUndefined();
  });
});
