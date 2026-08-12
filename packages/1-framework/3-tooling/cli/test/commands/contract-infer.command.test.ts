import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type {
  PslDocumentAst,
  PslExtensionBlock,
  PslSpan,
} from '@internal/framework-components/psl-ast';
import {
  makePslNamespace,
  makePslNamespaceEntries,
  UNSPECIFIED_PSL_NAMESPACE_ID,
} from '@internal/framework-components/psl-ast';
import { ok } from '@internal/utils/result';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeCommand, setupCommandMocks } from '../utils/test-helpers';

const SYNTHETIC_SPAN: PslSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

function buildSyntheticUserAst(): PslDocumentAst {
  const userModel = {
    kind: 'model' as const,
    name: 'User',
    fields: [
      {
        kind: 'field' as const,
        name: 'id',
        typeName: 'Int',
        optional: false,
        list: false,
        attributes: [
          {
            kind: 'attribute' as const,
            target: 'field' as const,
            name: 'id',
            args: [],
            span: SYNTHETIC_SPAN,
          },
        ],
        span: SYNTHETIC_SPAN,
      },
      {
        kind: 'field' as const,
        name: 'email',
        typeName: 'String',
        optional: false,
        list: false,
        attributes: [],
        span: SYNTHETIC_SPAN,
      },
    ],
    attributes: [],
    span: SYNTHETIC_SPAN,
  };
  return {
    kind: 'document',
    sourceId: 'test',
    namespaces: [
      makePslNamespace({
        kind: 'namespace',
        name: UNSPECIFIED_PSL_NAMESPACE_ID,
        entries: makePslNamespaceEntries([userModel], [], []),
        span: SYNTHETIC_SPAN,
      }),
    ],
    span: SYNTHETIC_SPAN,
  };
}

type CreateContractInferCommand =
  typeof import('../../src/commands/contract-infer')['createContractInferCommand'];

const mocks = vi.hoisted(() => {
  const loadConfigMock = vi.fn();
  const introspectMock = vi.fn();
  const toSchemaViewMock = vi.fn();
  const inferPslContractMock = vi.fn();
  const getPslBlockDescriptorsMock = vi.fn();
  const closeMock = vi.fn();
  const createControlClientMock = vi.fn(() => ({
    introspect: introspectMock,
    toSchemaView: toSchemaViewMock,
    inferPslContract: inferPslContractMock,
    getPslBlockDescriptors: getPslBlockDescriptorsMock,
    close: closeMock,
  }));

  return {
    loadConfigMock,
    introspectMock,
    toSchemaViewMock,
    inferPslContractMock,
    getPslBlockDescriptorsMock,
    closeMock,
    createControlClientMock,
  };
});

vi.mock('@internal/config-loader', () => ({
  loadConfigForSections: mocks.loadConfigMock,
}));

vi.mock('../../src/control-api/client', () => ({
  createControlClient: mocks.createControlClientMock,
}));

const baseConfig = {
  family: { familyId: 'sql' },
  target: { targetId: 'postgres' },
  adapter: {},
  driver: {},
  extensions: [],
  contract: {
    output: 'output/contract.json',
  },
  db: {
    connection: 'postgres://user:pass@localhost:5432/prisma_next',
  },
} as const;

const schemaIR = {
  tables: {
    user: {
      name: 'user',
      columns: {
        id: {
          name: 'id',
          nativeType: 'int4',
          nullable: false,
        },
        email: {
          name: 'email',
          nativeType: 'text',
          nullable: false,
        },
      },
      primaryKey: {
        columns: ['id'],
      },
      foreignKeys: [],
      uniques: [],
      indexes: [],
    },
  },
} as const;

describe('createContractInferCommand', () => {
  let consoleOutput: string[] = [];
  let consoleErrors: string[] = [];
  let cleanupMocks: () => void = () => {};
  let testDir: string;
  let createContractInferCommand: CreateContractInferCommand;
  const originalCwd = process.cwd();

  beforeEach(async () => {
    vi.resetModules();
    ({ createContractInferCommand } = await import('../../src/commands/contract-infer'));

    testDir = mkdtempSync(join(tmpdir(), 'prisma-next-contract-infer-'));
    const commandMocks = setupCommandMocks();
    consoleOutput = commandMocks.consoleOutput;
    consoleErrors = commandMocks.consoleErrors;
    cleanupMocks = commandMocks.cleanup;

    mocks.loadConfigMock.mockResolvedValue(ok(baseConfig));
    mocks.introspectMock.mockResolvedValue(schemaIR);
    mocks.toSchemaViewMock.mockReturnValue(undefined);
    mocks.inferPslContractMock.mockReturnValue(buildSyntheticUserAst());
    mocks.getPslBlockDescriptorsMock.mockReturnValue({});
    mocks.closeMock.mockResolvedValue(undefined);
    mocks.createControlClientMock.mockClear();
  }, timeouts.typeScriptCompilation);

  afterEach(() => {
    process.chdir(originalCwd);
    cleanupMocks();
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  }, timeouts.typeScriptCompilation);

  it('writes to a custom output path when --output is provided', async () => {
    process.chdir(testDir);

    await executeCommand(createContractInferCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--output',
      'prisma/custom-contract.prisma',
      '--no-color',
    ]);

    const customOutputPath = join(testDir, 'prisma/custom-contract.prisma');
    expect(existsSync(customOutputPath)).toBe(true);
    expect(readFileSync(customOutputPath, 'utf-8')).toContain('model User');
    expect(consoleErrors.join('\n')).toContain('Contract written to prisma/custom-contract.prisma');
  });

  it('warns before overwriting an existing inferred PSL file', async () => {
    process.chdir(testDir);

    const command = createContractInferCommand();
    await executeCommand(command, ['--config', 'prisma-next.config.ts', '--no-color']);
    consoleOutput.length = 0;
    consoleErrors.length = 0;

    await executeCommand(command, ['--config', 'prisma-next.config.ts', '--no-color']);

    const stderrOutput = consoleErrors.join('\n');
    expect(stderrOutput).toContain('Overwriting existing file: output/contract.prisma');
    expect(stderrOutput).toContain('Contract written to output/contract.prisma');
  });

  it('writes the default inferred PSL next to the config file when --config points to a nested project', async () => {
    process.chdir(testDir);

    await executeCommand(createContractInferCommand(), [
      '--config',
      'apps/web/prisma-next.config.ts',
      '--no-color',
    ]);

    expect(existsSync(join(testDir, 'apps/web/output/contract.prisma'))).toBe(true);
    expect(existsSync(join(testDir, 'output/contract.prisma'))).toBe(false);
    expect(consoleErrors.join('\n')).toContain(
      'Contract written to apps/web/output/contract.prisma',
    );
  });

  it('suppresses overwrite warnings and success output in quiet mode', async () => {
    process.chdir(testDir);

    const command = createContractInferCommand();
    await executeCommand(command, ['--config', 'prisma-next.config.ts', '--no-color']);
    consoleOutput.length = 0;
    consoleErrors.length = 0;

    await executeCommand(command, ['--config', 'prisma-next.config.ts', '--quiet', '--no-color']);

    const stderrOutput = consoleErrors.join('\n');
    expect(stderrOutput).not.toContain('Overwriting existing file');
    expect(stderrOutput).not.toContain('Contract written to');
  });

  it('prints JSON output in --json mode while still writing the inferred PSL file', async () => {
    process.chdir(testDir);

    await executeCommand(createContractInferCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--json',
      '--no-color',
    ]);

    const parsed = JSON.parse(consoleOutput.join('\n')) as {
      readonly summary: string;
      readonly psl: { readonly path: string };
      readonly meta: { readonly configPath: string; readonly dbUrl: string };
    };
    expect(parsed).toMatchObject({
      summary: 'Contract inferred successfully',
      psl: { path: 'output/contract.prisma' },
      meta: {
        configPath: 'prisma-next.config.ts',
        dbUrl: 'postgres://****:****@localhost:5432/prisma_next',
      },
    });
    expect(consoleErrors).toEqual([]);
    expect(existsSync(join(testDir, 'output/contract.prisma'))).toBe(true);
  });

  it('returns inspect errors without writing an inferred PSL file', async () => {
    process.chdir(testDir);
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        driver: undefined,
      }),
    );

    await expect(
      executeCommand(createContractInferCommand(), [
        '--config',
        'prisma-next.config.ts',
        '--no-color',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(existsSync(join(testDir, 'output/contract.prisma'))).toBe(false);
    expect(consoleErrors.join('\n')).toContain('Driver is required for DB-connected commands');
  });

  it('returns a capability-based error when the family does not implement contract inference', async () => {
    process.chdir(testDir);
    mocks.loadConfigMock.mockResolvedValue(
      ok({
        ...baseConfig,
        family: { familyId: 'mongo' },
        target: { targetId: 'mongo' },
        db: { connection: 'mongodb://localhost:27017/test' },
      }),
    );
    mocks.inferPslContractMock.mockReturnValue(undefined);

    await expect(
      executeCommand(createContractInferCommand(), [
        '--config',
        'prisma-next.config.ts',
        '--no-color',
      ]),
    ).rejects.toThrow('process.exit called');

    expect(existsSync(join(testDir, 'output/contract.prisma'))).toBe(false);
    const stderr = consoleErrors.join('\n');
    expect(stderr).toContain('contract infer is not supported for this family');
    // Capability-based wording — must not name the familyId string directly.
    expect(stderr).not.toContain('family "mongo"');
  });

  it('renders a declarative policy_select extension block in the written PSL', async () => {
    process.chdir(testDir);

    // A minimal declarative pslBlockDescriptors namespace for a `policy_select` block.
    // The generic printer (P2) reads the descriptor's `parameters` map and renders
    // each parameter by kind — no contributed printer function needed.
    const policySelectDiscriminator = 'cmd-test-policy-select';
    const policySelectPslBlocks = {
      policy_select: {
        kind: 'pslBlock' as const,
        keyword: 'policy_select',
        discriminator: policySelectDiscriminator,
        name: { required: true as const },
        parameters: {
          target: {
            kind: 'ref' as const,
            refKind: 'model' as const,
            scope: 'same-namespace' as const,
            required: true as const,
          },
          using: { kind: 'value' as const, codecId: 'test-codec@1', required: true as const },
        },
      },
    };
    mocks.getPslBlockDescriptorsMock.mockReturnValue(policySelectPslBlocks);

    // Build an AST whose namespace contains a policy_select extension block.
    // The `using` value param stores the raw PSL literal (including quotes);
    // without a codecLookup the printer emits the raw string as-is.
    const policySelectBlock: PslExtensionBlock = {
      kind: policySelectDiscriminator,
      keyword: 'policy_select',
      name: 'ReadOnlyUsers',
      parameters: {
        target: { kind: 'ref', identifier: 'User', span: SYNTHETIC_SPAN },
        using: { kind: 'value', raw: '"auth.uid() = user_id"', span: SYNTHETIC_SPAN },
      },
      blockAttributes: [],
      span: SYNTHETIC_SPAN,
    };
    const astWithPolicySelect: PslDocumentAst = {
      kind: 'document',
      sourceId: 'test',
      namespaces: [
        makePslNamespace({
          kind: 'namespace',
          name: UNSPECIFIED_PSL_NAMESPACE_ID,
          entries: makePslNamespaceEntries([], [], [policySelectBlock]),
          span: SYNTHETIC_SPAN,
        }),
      ],
      span: SYNTHETIC_SPAN,
    };
    mocks.inferPslContractMock.mockReturnValue(astWithPolicySelect);

    await executeCommand(createContractInferCommand(), [
      '--config',
      'prisma-next.config.ts',
      '--no-color',
    ]);

    const outputPath = join(testDir, 'output/contract.prisma');
    expect(existsSync(outputPath)).toBe(true);
    const content = readFileSync(outputPath, 'utf-8');
    expect(content).toContain('policy_select ReadOnlyUsers {');
    expect(content).toContain('target = User');
    expect(content).toContain('using = "auth.uid() = user_id"');
  });
});
