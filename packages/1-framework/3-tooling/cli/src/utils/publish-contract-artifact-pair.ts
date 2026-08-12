import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'pathe';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function createTempArtifactPath(path: string, publicationToken: string, phase: string): string {
  return join(dirname(path), `.${basename(path)}.${process.pid}.${publicationToken}.${phase}.tmp`);
}

type PreviousArtifact = { readonly content: string } | 'remove';

async function readExistingArtifact(path: string): Promise<PreviousArtifact> {
  try {
    return { content: await readFile(path, 'utf-8') };
  } catch (error) {
    if (isRecord(error) && error['code'] === 'ENOENT') {
      return 'remove';
    }
    throw error;
  }
}

async function restoreArtifact(
  path: string,
  previous: PreviousArtifact,
  publicationToken: string,
): Promise<void> {
  if (previous === 'remove') {
    await rm(path, { force: true });
    return;
  }

  const restorePath = createTempArtifactPath(path, publicationToken, 'rollback');
  await writeFile(restorePath, previous.content, 'utf-8');
  try {
    await rename(restorePath, path);
  } finally {
    await rm(restorePath, { force: true });
  }
}

interface PublishEntry {
  readonly tempPath: string;
  readonly outputPath: string;
  readonly previous: PreviousArtifact;
}

function withRollbackFailureCause(error: unknown, rollbackFailures: readonly unknown[]): Error {
  const rollbackCause = new AggregateError(
    rollbackFailures,
    'Failed to restore published artifacts',
  );

  if (error instanceof Error) {
    Object.defineProperty(error, 'cause', {
      value: rollbackCause,
      configurable: true,
      writable: true,
    });
    return error;
  }

  return new Error(String(error), { cause: rollbackCause });
}

async function publishPairWithRollback(
  entries: readonly PublishEntry[],
  publicationToken: string,
): Promise<void> {
  const replaced: PublishEntry[] = [];
  try {
    for (const entry of entries) {
      await rename(entry.tempPath, entry.outputPath);
      replaced.push(entry);
    }
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      replaced.map((entry) => restoreArtifact(entry.outputPath, entry.previous, publicationToken)),
    );
    const rollbackFailures = rollbackResults.flatMap((result) =>
      result.status === 'rejected' ? [result.reason] : [],
    );

    if (rollbackFailures.length > 0) {
      throw withRollbackFailureCause(error, rollbackFailures);
    }

    throw error;
  }
}

export async function publishContractArtifactPair({
  outputJsonPath,
  outputDtsPath,
  contractJson,
  contractDts,
  publicationToken,
  beforePublish,
}: {
  readonly outputJsonPath: string;
  readonly outputDtsPath: string;
  readonly contractJson: string;
  readonly contractDts: string;
  readonly publicationToken: string;
  readonly beforePublish?: () => Promise<boolean> | boolean;
}): Promise<boolean> {
  const tempJsonPath = createTempArtifactPath(outputJsonPath, publicationToken, 'next');
  const tempDtsPath = createTempArtifactPath(outputDtsPath, publicationToken, 'next');

  try {
    await writeFile(tempJsonPath, contractJson, 'utf-8');
    await writeFile(tempDtsPath, contractDts, 'utf-8');

    if ((await beforePublish?.()) === false) {
      return false;
    }

    const previousJson = await readExistingArtifact(outputJsonPath);
    const previousDts = await readExistingArtifact(outputDtsPath);

    await publishPairWithRollback(
      [
        { tempPath: tempDtsPath, outputPath: outputDtsPath, previous: previousDts },
        { tempPath: tempJsonPath, outputPath: outputJsonPath, previous: previousJson },
      ],
      publicationToken,
    );
    return true;
  } finally {
    await Promise.allSettled([rm(tempJsonPath, { force: true }), rm(tempDtsPath, { force: true })]);
  }
}
