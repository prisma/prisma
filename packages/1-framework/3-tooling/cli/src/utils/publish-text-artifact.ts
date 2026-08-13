import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'pathe';

/**
 * Writes a generated file the way `contract emit` publishes its pair: the
 * bytes land in a temporary file beside the target and are renamed over it, so
 * a run interrupted mid-write leaves the previous file intact rather than a
 * truncated one.
 */
export async function publishTextArtifact(inputs: {
  readonly path: string;
  readonly content: string;
  readonly publicationToken: string;
}): Promise<void> {
  const directory = dirname(inputs.path);
  const tempPath = join(
    directory,
    `.${basename(inputs.path)}.${process.pid}.${inputs.publicationToken}.next.tmp`,
  );

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(tempPath, inputs.content, 'utf-8');
    await rename(tempPath, inputs.path);
  } finally {
    await rm(tempPath, { force: true });
  }
}
