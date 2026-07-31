import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    rename: vi.fn(actual.rename),
    writeFile: vi.fn(actual.writeFile),
  };
});

type FsPromisesModule = typeof import('node:fs/promises');

const PREVIOUS_JSON = JSON.stringify({ generation: 'previous' });
const PREVIOUS_DTS = "export type Generation = 'previous';\n";
const NEXT_JSON = JSON.stringify({ generation: 'next' });
const NEXT_DTS = "export type Generation = 'next';\n";

interface ArtifactPaths {
  readonly outputJsonPath: string;
  readonly outputDtsPath: string;
}

describe('publishContractArtifactPair', () => {
  let tmpDir = '';
  let actualFs: FsPromisesModule;
  let mockedFs: FsPromisesModule;
  let publishContractArtifactPair: typeof import('../../src/utils/publish-contract-artifact-pair')['publishContractArtifactPair'];

  async function seedPreviousArtifacts(): Promise<ArtifactPaths> {
    const outputJsonPath = join(tmpDir, 'src/prisma/contract.json');
    const outputDtsPath = join(tmpDir, 'src/prisma/contract.d.ts');
    await actualFs.mkdir(join(tmpDir, 'src/prisma'), { recursive: true });
    await actualFs.writeFile(outputJsonPath, PREVIOUS_JSON, 'utf-8');
    await actualFs.writeFile(outputDtsPath, PREVIOUS_DTS, 'utf-8');
    return { outputJsonPath, outputDtsPath };
  }

  function publishNext(
    paths: ArtifactPaths,
    options: { readonly beforePublish?: () => Promise<boolean> | boolean } = {},
  ): Promise<boolean> {
    return publishContractArtifactPair({
      ...paths,
      contractJson: NEXT_JSON,
      contractDts: NEXT_DTS,
      publicationToken: 'publish',
      ...options,
    });
  }

  beforeEach(async () => {
    vi.resetModules();

    actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    mockedFs = await import('node:fs/promises');
    ({ publishContractArtifactPair } = await import(
      '../../src/utils/publish-contract-artifact-pair'
    ));

    vi.mocked(mockedFs.rename).mockReset();
    vi.mocked(mockedFs.writeFile).mockReset();
    vi.mocked(mockedFs.rename).mockImplementation(async (...args) => actualFs.rename(...args));
    vi.mocked(mockedFs.writeFile).mockImplementation(async (...args) =>
      actualFs.writeFile(...args),
    );

    tmpDir = await actualFs.mkdtemp(join(tmpdir(), 'publish-contract-artifacts-'));
  });

  afterEach(async () => {
    if (tmpDir.length > 0) {
      await actualFs.rm(tmpDir, { recursive: true, force: true });
      tmpDir = '';
    }
  }, timeouts.databaseOperation);

  it('publishes contract.d.ts before contract.json', async () => {
    const { outputJsonPath, outputDtsPath } = await seedPreviousArtifacts();
    const snapshots: Array<{
      readonly json: string | undefined;
      readonly dts: string | undefined;
      readonly to: string;
    }> = [];

    vi.mocked(mockedFs.rename).mockImplementation(async (...args) => {
      const [, to] = args;
      await actualFs.rename(...args);
      snapshots.push({
        json: await actualFs.readFile(outputJsonPath, 'utf-8').catch(() => undefined),
        dts: await actualFs.readFile(outputDtsPath, 'utf-8').catch(() => undefined),
        to: String(to),
      });
    });

    await publishNext({ outputJsonPath, outputDtsPath });

    expect(snapshots).toEqual([
      { json: PREVIOUS_JSON, dts: NEXT_DTS, to: outputDtsPath },
      { json: NEXT_JSON, dts: NEXT_DTS, to: outputJsonPath },
    ]);
  });

  it('skips publication when beforePublish returns false', async () => {
    const { outputJsonPath, outputDtsPath } = await seedPreviousArtifacts();
    const beforePublish = vi.fn().mockReturnValue(false);

    await expect(publishNext({ outputJsonPath, outputDtsPath }, { beforePublish })).resolves.toBe(
      false,
    );

    expect(beforePublish).toHaveBeenCalledTimes(1);
    expect(vi.mocked(mockedFs.rename)).not.toHaveBeenCalled();
    expect(await actualFs.readFile(outputJsonPath, 'utf-8')).toBe(PREVIOUS_JSON);
    expect(await actualFs.readFile(outputDtsPath, 'utf-8')).toBe(PREVIOUS_DTS);
  });

  it('preserves the previous artifacts when the next publish write fails', async () => {
    const { outputJsonPath, outputDtsPath } = await seedPreviousArtifacts();

    vi.mocked(mockedFs.writeFile).mockImplementation(async (...args) => {
      const [path] = args;
      if (String(path).includes('contract.d.ts') && String(path).includes('.next.tmp')) {
        throw new Error('simulated dts write failure');
      }
      return actualFs.writeFile(...args);
    });

    await expect(publishNext({ outputJsonPath, outputDtsPath })).rejects.toThrow(
      'simulated dts write failure',
    );

    expect(await actualFs.readFile(outputJsonPath, 'utf-8')).toBe(PREVIOUS_JSON);
    expect(await actualFs.readFile(outputDtsPath, 'utf-8')).toBe(PREVIOUS_DTS);
  });

  it('attaches rollback failures to the publish error cause', async () => {
    const { outputJsonPath, outputDtsPath } = await seedPreviousArtifacts();
    const publishError = new Error('simulated json rename failure');
    const rollbackError = new Error('simulated rollback rename failure');

    vi.mocked(mockedFs.rename).mockImplementation(async (...args) => {
      const [, to] = args;
      if (String(to) === outputJsonPath) {
        throw publishError;
      }
      if (String(to) === outputDtsPath && String(args[0]).includes('.rollback.tmp')) {
        throw rollbackError;
      }
      return actualFs.rename(...args);
    });

    await expect(publishNext({ outputJsonPath, outputDtsPath })).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBe(publishError);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error & { cause?: unknown }).cause).toBeInstanceOf(AggregateError);
        expect((error as Error & { cause?: AggregateError }).cause?.errors).toEqual([
          rollbackError,
        ]);
        return true;
      },
    );

    expect(await actualFs.readFile(outputJsonPath, 'utf-8')).toBe(PREVIOUS_JSON);
    expect(await actualFs.readFile(outputDtsPath, 'utf-8')).toBe(NEXT_DTS);
  });
});
