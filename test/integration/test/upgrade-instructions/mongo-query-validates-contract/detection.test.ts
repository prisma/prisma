import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATH =
  'upgrade-instructions/pending/mongo-query-validates-contract/app/instructions.md';
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const id = 'mongo-query-validates-contract';

function detects(content: string): boolean {
  const guide = readFileSync(join(repoRoot, GUIDE_PATH), 'utf-8');
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The guide has no change ${id}`);
  const patterns = [...entry.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
  if (patterns.length === 0) throw new Error(`The change ${id} has no detection`);
  return patterns.some((pattern) => pattern.test(content));
}

describe('the mongoQuery detection', () => {
  it.each([
    ['a call', 'const query = mongoQuery({ contract });'],
    ['a call with a space', 'mongoQuery ({ contract })'],
  ])('finds %s', (_name, content) => {
    expect(detects(content)).toBe(true);
  });

  it.each([
    ['a method of the same name', 'db.mongoQuery({ contract })'],
    ['a longer name', 'myMongoQuery({ contract })'],
    ['an import only', "import { acc } from 'somewhere';"],
  ])('skips %s', (_name, content) => {
    expect(detects(content)).toBe(false);
  });
});
