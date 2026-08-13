import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as configLoader from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import type { EmitResult } from '@internal/emitter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeContractEmit } from '../../src/control-api/operations/contract-emit';
import type { ContractEmitOptions } from '../../src/control-api/types';
import { disposeEmitQueue } from '../../src/utils/emit-queue';

const mockedEmit = vi.fn<typeof import('@internal/emitter')['emit']>();

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    mkdir: vi.fn(actual.mkdir),
    rename: vi.fn(actual.rename),
    writeFile: vi.fn(actual.writeFile),
  };
});

type FsModule = typeof import('node:fs/promises');

const mockedRename = vi.mocked(rename);
const mockedWriteFile = vi.mocked(writeFile);
const emitDependencies = { emit: mockedEmit };

function executeContractEmitWithMock(options: ContractEmitOptions) {
  return executeContractEmit(options, emitDependencies);
}

const stubDescriptor = (kind: string, id: string) => ({
  kind,
  id,
  version: '0.0.1',
});

function mockConfigWithContract(contractOverrides: Record<string, unknown>) {
  return {
    family: stubDescriptor('family', 'test'),
    target: stubDescriptor('target', 'test'),
    contract: contractOverrides,
  } as unknown as configLoader.PrismaNextConfig;
}

function createSourceProvider(load: () => Promise<unknown>): {
  readonly inputs?: readonly string[];
  load: () => Promise<unknown>;
} {
  return { load };
}

function createMockContract(): Contract {
  return {
    capabilities: {},
    extensions: {},
  } as unknown as Contract;
}

function createEmitResult(generation: string): EmitResult {
  return {
    storageHash: `storage-${generation}`,
    profileHash: `profile-${generation}`,
    contractJson: JSON.stringify({ generation }),
    contractDts: `export type Generation = '${generation}';\n`,
  };
}

function createSuccessfulConfig(output: string) {
  const familyInstance = {
    deserializeContract: vi.fn(),
  };

  return {
    family: {
      id: 'family:test',
      version: '0.0.1',
      familyId: 'test-family',
      emission: {},
      create: () => familyInstance,
    },
    target: {
      kind: 'target',
      id: 'target:test',
      version: '0.0.1',
      familyId: 'test-family',
      targetId: 'test-target',
      contractSerializer: {
        serializeContract: (contract: unknown) => contract,
        deserializeContract: (json: unknown) => json,
      },
    },
    adapter: {
      kind: 'adapter',
      id: 'adapter:test',
      version: '0.0.1',
      familyId: 'test-family',
      targetId: 'test-target',
    },
    extensions: [],
    contract: {
      source: createSourceProvider(async () => ({
        ok: true as const,
        value: createMockContract(),
      })),
      output,
    },
  } as unknown as configLoader.PrismaNextConfig;
}

describe('executeContractEmit', () => {
  let tmpDir = '';
  let actualFs: FsModule;

  beforeEach(async () => {
    actualFs = await vi.importActual<FsModule>('node:fs/promises');
    tmpDir = await mkdtemp(join(tmpdir(), 'contract-emit-'));
    mockedEmit.mockReset();
    mockedRename.mockReset();
    mockedWriteFile.mockReset();
    mockedRename.mockImplementation(async (...args) => actualFs.rename(...args));
    mockedWriteFile.mockImplementation(async (...args) => actualFs.writeFile(...args));
  });

  afterEach(async () => {
    if (tmpDir.length > 0) {
      await rm(tmpDir, { recursive: true, force: true });
    }
    // isolate: false — avoid vi.restoreAllMocks(); it restores hoisted vi.mock
    // modules from other test files loaded in this worker (e.g. node:child_process).
  });

  function emitOptions(
    config: configLoader.PrismaNextConfig,
    configPath = 'prisma-next.config.ts',
  ) {
    return { config, cwd: tmpDir, configPath };
  }

  it('throws when the config declares no contract section', async () => {
    const config = {
      family: stubDescriptor('family', 'test'),
    } as unknown as configLoader.PrismaNextConfig;
    await expect(executeContractEmitWithMock(emitOptions(config))).rejects.toThrow();
  });

  it('respects signal cancellation before starting', async () => {
    await expect(
      executeContractEmitWithMock({
        ...emitOptions(mockConfigWithContract({ output: './src/prisma/contract.json' })),
        signal: AbortSignal.abort(),
      }),
    ).rejects.toSatisfy((error: unknown) => error instanceof Error && error.name === 'AbortError');
  });

  it('preserves AbortError from contract source provider', async () => {
    await expect(
      executeContractEmitWithMock(
        emitOptions(
          mockConfigWithContract({
            source: createSourceProvider(async () => {
              throw new DOMException('Aborted by test', 'AbortError');
            }),
            output: './src/prisma/contract.json',
          }),
        ),
      ),
    ).rejects.toSatisfy((error: unknown) => error instanceof Error && error.name === 'AbortError');
  });

  describe.each([
    {
      label: 'rejects non-provider source object',
      source: { invalid: true },
      expectedSubstring: 'valid source provider object',
    },
    {
      label: 'translates provider failure result to runtime error',
      source: createSourceProvider(async () => ({
        ok: false,
        failure: {
          summary: 'Provider parse failed',
          diagnostics: [{ code: 'PSL_PARSE_ERROR', message: 'Unexpected token' }],
          meta: { sourceId: 'schema.prisma' },
        },
      })),
      expectedCode: 'CONTRACT.SOURCE_LOAD_FAILED',
      expectedSubstring: 'Provider parse failed',
    },
    {
      label: 'rejects malformed failure result',
      source: createSourceProvider(async () => ({ ok: false }) as unknown),
      expectedCode: 'CONTRACT.SOURCE_LOAD_FAILED',
      expectedSubstring: 'malformed failure result',
    },
    {
      label: 'rejects malformed success result',
      source: createSourceProvider(async () => ({ ok: true }) as unknown),
      expectedCode: 'CONTRACT.SOURCE_LOAD_FAILED',
      expectedSubstring: 'malformed success result',
    },
  ])('source provider validation', ({ label, source, expectedCode, expectedSubstring }) => {
    it(label, async () => {
      await expect(
        executeContractEmitWithMock(
          emitOptions(mockConfigWithContract({ source, output: './src/prisma/contract.json' })),
        ),
      ).rejects.toSatisfy((error: unknown) => {
        if (!(error instanceof Error)) return false;
        const why = (error as { why?: unknown }).why;
        if (typeof why !== 'string' || !why.includes(expectedSubstring)) return false;
        if (expectedCode !== undefined) {
          return (error as { code?: unknown }).code === expectedCode;
        }
        return true;
      });
    });
  });

  it('passes deserializeContract output to emit, not the pre-hydration envelope', async () => {
    const outputJsonPath = join(tmpDir, 'src/prisma/contract.json');
    const plainEnvelope = createMockContract();
    const hydratedContract = {
      ...plainEnvelope,
      storageHydrated: true,
    } as unknown as Contract;
    const deserializeContract = vi.fn(() => hydratedContract);
    const config = createSuccessfulConfig(outputJsonPath);
    const familyWithHydration = {
      ...config.family,
      create: () => ({ deserializeContract }),
    };
    mockedEmit.mockResolvedValueOnce(createEmitResult('hydrated'));

    await executeContractEmitWithMock(
      emitOptions(
        { ...config, family: familyWithHydration as unknown as typeof config.family },
        join(tmpDir, 'prisma-next.config.ts'),
      ),
    );

    expect(deserializeContract).toHaveBeenCalledOnce();
    expect(mockedEmit).toHaveBeenCalledOnce();
    const emitContract = mockedEmit.mock.calls[0]?.[0];
    expect(emitContract).toBe(hydratedContract);
    expect(emitContract).not.toBe(plainEnvelope);
  });

  describe('the import root the emitted files are written against', () => {
    async function emitInto(project: string, options: { readonly namesConfig: boolean }) {
      const outputJsonPath = join(tmpDir, project, 'generated/contract.json');
      await actualFs.mkdir(join(tmpDir, project), { recursive: true });
      await actualFs.writeFile(
        join(tmpDir, project, 'package.json'),
        JSON.stringify({
          name: project,
          dependencies: { '@prisma/orm-postgres': '8.0.0-rc.1' },
        }),
        'utf-8',
      );
      mockedEmit.mockResolvedValueOnce(createEmitResult('specifiers'));

      await executeContractEmitWithMock(
        options.namesConfig
          ? emitOptions(
              createSuccessfulConfig(outputJsonPath),
              join(tmpDir, project, 'prisma-next.config.ts'),
            )
          : { config: createSuccessfulConfig(outputJsonPath), cwd: tmpDir },
      );

      const resolveSpecifier = mockedEmit.mock.calls.at(-1)?.[3]?.resolveImportSpecifier;
      return resolveSpecifier?.('@internal/contract/types');
    }

    it('is the project the artifacts are written into, not the working directory', async () => {
      expect(await emitInto('app-a', { namesConfig: false })).toBe(
        '@prisma/orm-postgres/contract/types',
      );
    });

    it('is the project holding the config file when the caller names one', async () => {
      expect(await emitInto('app-b', { namesConfig: true })).toBe(
        '@prisma/orm-postgres/contract/types',
      );
    });
  });

  it('serializes overlapping emits per output path so the last submission wins on disk', async () => {
    const outputJsonPath = join(tmpDir, 'src/prisma/contract.json');
    const outputDtsPath = join(tmpDir, 'src/prisma/contract.d.ts');
    const firstEmit = Promise.withResolvers<EmitResult>();
    const firstEntered = Promise.withResolvers<void>();

    mockedEmit
      .mockImplementationOnce(() => {
        firstEntered.resolve();
        return firstEmit.promise;
      })
      .mockResolvedValueOnce(createEmitResult('newer'));

    try {
      const options = emitOptions(
        createSuccessfulConfig(outputJsonPath),
        join(tmpDir, 'prisma-next.config.ts'),
      );
      const first = executeContractEmitWithMock(options);
      await firstEntered.promise;
      const second = executeContractEmitWithMock(options);

      // Second is queued behind first — emit() must not be called for second yet.
      expect(mockedEmit).toHaveBeenCalledTimes(1);

      firstEmit.resolve(createEmitResult('older'));
      await Promise.all([first, second]);

      expect(mockedEmit).toHaveBeenCalledTimes(2);

      // Last submission wins on disk.
      expect(await readFile(outputJsonPath, 'utf-8')).toBe(JSON.stringify({ generation: 'newer' }));
      expect(await readFile(outputDtsPath, 'utf-8')).toBe("export type Generation = 'newer';\n");
    } finally {
      disposeEmitQueue(outputJsonPath);
    }
  });
});
