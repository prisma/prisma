import { GLOBSTAR, Minimatch } from 'minimatch';
import { dirname, isAbsolute, join, relative } from 'pathe';

export function contractInputDirectory(input: string): string {
  const patterns = new Minimatch(input, {
    nonegate: true,
    nocomment: true,
    optimizationLevel: 0,
    preserveMultipleSlashes: true,
  }).set;
  let common: string | undefined;
  for (const parts of patterns) {
    const prefix: string[] = [];
    for (const part of parts.slice(0, -1)) {
      if (typeof part !== 'string') break;
      prefix.push(part);
    }
    let directory = dirname([...prefix, '_'].join('/'));
    let depth = 0;
    for (const part of parts.slice(prefix.length)) {
      if (part === '..') {
        if (depth > 0) depth--;
        else directory = join(directory, '..');
      } else if (part !== GLOBSTAR && part !== '.' && part !== '') {
        depth++;
      }
    }
    if (common === undefined) {
      common = directory;
      continue;
    }
    let difference = relative(common, directory);
    while (difference === '..' || difference.startsWith('../') || isAbsolute(difference)) {
      const parent = join(common, '..');
      if (parent === common) break;
      common = parent;
      difference = relative(common, directory);
    }
  }
  const directory = common ?? dirname(input);
  return input.startsWith('./') &&
    directory !== '.' &&
    directory !== '..' &&
    !directory.startsWith('./') &&
    !directory.startsWith('../')
    ? `./${directory}`
    : directory;
}
