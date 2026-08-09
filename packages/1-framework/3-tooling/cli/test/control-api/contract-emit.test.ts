import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as configLoader from '@internal/config-loader';
import type { Contract } from '@internal/contract/types';
import type { EmitResult } from '@internal/emitter';
import { emit as emitFn } from '@internal/emitter';
import { ok } from '@internal/utils/result';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { executeContractEmit } from '../../src/control-api/operations/contract-emit';
import { disposeEmitQueue } from '../../src/utils/emit-queue';

vi.mock('@internal/config-loader', { spy: true });

vi.mock('@internal/emitter', async () => {
  const actual = await vi.importActual<typeof import('@internal/emitter')>('@internal/emitter');
  return {
    ...actual,
    emit: vi.fn(),
  };
});

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

const mockedEmit = vi.mocked(emitFn);
const mockedRename = vi.mocked(rename);
const mockedWriteFile = vi.mocked(writeFile);

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

  async function withMockedConfig<T>(
    config: configLoader.PrismaNextConfig,
    run: () => Promise<T>,
  ): Promise<T> {
    const loadConfigSpy = vi
      .spyOn(configLoader, 'loadConfigForSections')
      .mockResolvedValue(ok(config));
    try {
      return await run();
    } finally {
      loadConfigSpy.mockRestore();
    }
  }

  it('throws when configPath does not exist', async () => {
    await expect(executeContractEmit({ configPath: '/nonexistent/config.ts' })).rejects.toThrow();
  });

  it('respects signal cancellation before starting', async () => {
    await expect(
      executeContractEmit({
        configPath: 'prisma-next.config.ts',
        signal: AbortSignal.abort(),
      }),
    ).rejects.toSatisfy((error: unknown) => error instanceof Error && error.name === 'AbortError');
  });

  it('preserves AbortError from contract source provider', async () => {
    await withMockedConfig(
      mockConfigWithContract({
        source: createSourceProvider(async () => {
          throw new DOMException('Aborted by test', 'AbortError');
        }),
        output: './src/prisma/contract.json',
      }),
      async () => {
        await expect(
          executeContractEmit({ configPath: 'prisma-next.config.ts' }),
        ).rejects.toSatisfy(
          (error: unknown) => error instanceof Error && error.name === 'AbortError',
        );
      },
    );
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
      await withMockedConfig(
        mockConfigWithContract({ source, output: './src/prisma/contract.json' }),
        async () => {
          await expect(
            executeContractEmit({ configPath: 'prisma-next.config.ts' }),
          ).rejects.toSatisfy((error: unknown) => {
            if (!(error instanceof Error)) return false;
            const why = (error as { why?: unknown }).why;
            if (typeof why !== 'string' || !why.includes(expectedSubstring)) return false;
            if (expectedCode !== undefined) {
              return (error as { code?: unknown }).code === expectedCode;
            }
            return true;
          });
        },
      );
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

    await withMockedConfig(
      { ...config, family: familyWithHydration as unknown as typeof config.family },
      async () => {
        await executeContractEmit({ configPath: join(tmpDir, 'prisma-next.config.ts') });
      },
    );

    expect(deserializeContract).toHaveBeenCalledOnce();
    expect(mockedEmit).toHaveBeenCalledOnce();
    const emitContract = mockedEmit.mock.calls[0]?.[0];
    expect(emitContract).toBe(hydratedContract);
    expect(emitContract).not.toBe(plainEnvelope);
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
      await withMockedConfig(createSuccessfulConfig(outputJsonPath), async () => {
        const first = executeContractEmit({ configPath: join(tmpDir, 'prisma-next.config.ts') });
        await firstEntered.promise;
        const second = executeContractEmit({ configPath: join(tmpDir, 'prisma-next.config.ts') });

        // Second is queued behind first — emit() must not be called for second yet.
        expect(mockedEmit).toHaveBeenCalledTimes(1);

        firstEmit.resolve(createEmitResult('older'));
        await Promise.all([first, second]);

        expect(mockedEmit).toHaveBeenCalledTimes(2);
      });

      // Last submission wins on disk.
      expect(await readFile(outputJsonPath, 'utf-8')).toBe(JSON.stringify({ generation: 'newer' }));
      expect(await readFile(outputDtsPath, 'utf-8')).toBe("export type Generation = 'newer';\n");
    } finally {
      disposeEmitQueue(outputJsonPath);
    }
  });
});
