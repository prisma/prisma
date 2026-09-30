import { glob, stat } from 'node:fs/promises';
import { matchesGlob } from 'node:path';
import { resolve } from 'pathe';
import { isDynamicPattern } from 'tinyglobby';

const UNC_PREFIX_RE = /^(?:\\\\|\/\/)/;

function isUncLike(entry: string): boolean {
  return UNC_PREFIX_RE.test(entry);
}

function resolveLiteral(entry: string): string {
  return isUncLike(entry) ? entry : resolve(entry);
}

export async function expandContractInputs(
  patterns: readonly string[] | undefined,
): Promise<readonly string[]> {
  if (patterns === undefined || patterns.length === 0) {
    return [];
  }
  const literals: string[] = [];
  const globPatterns: string[] = [];
  for (const pattern of patterns) {
    (isDynamicPattern(pattern) ? globPatterns : literals).push(pattern);
  }
  const canonical = new Set(literals.map(resolveLiteral));
  if (globPatterns.length > 0) {
    for await (const entry of glob(globPatterns, { withFileTypes: true })) {
      const path = resolve(entry.parentPath, entry.name);
      if (
        entry.isFile() ||
        (entry.isSymbolicLink() && (await stat(path, { throwIfNoEntry: false }))?.isFile())
      ) {
        canonical.add(path);
      }
    }
  }
  return Array.from(canonical).sort();
}

export function globContractInputMatching(
  patterns: readonly string[],
  path: string,
): string | undefined {
  return patterns.find((pattern) => isDynamicPattern(pattern) && matchesGlob(path, pattern));
}
