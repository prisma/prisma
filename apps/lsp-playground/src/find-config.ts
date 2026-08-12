import { access } from 'node:fs/promises';
import { dirname, join, parse } from 'node:path';

const CONFIG_FILENAME = 'prisma-next.config.ts';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Walks up from the directory containing `absoluteSchemaPath` looking for an
 * existing `prisma-next.config.ts`. Returns its absolute path, or `undefined`
 * when none is found up to the filesystem root — in which case the caller
 * falls back to a generated default-postgres config.
 */
export async function findNearestConfig(absoluteSchemaPath: string): Promise<string | undefined> {
  const { root } = parse(absoluteSchemaPath);
  let dir = dirname(absoluteSchemaPath);
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (await exists(candidate)) {
      return candidate;
    }
    if (dir === root) {
      return undefined;
    }
    dir = dirname(dir);
  }
}
