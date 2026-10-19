import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATHS = {
  app: 'upgrade-instructions/pending/collections-on-the-client/app/instructions.md',
  extension: 'upgrade-instructions/pending/collections-on-the-client/extension/instructions.md',
} as const;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');

function detection(audience: keyof typeof GUIDE_PATHS): RegExp {
  const guide = readFileSync(join(repoRoot, GUIDE_PATHS[audience]), 'utf8');
  const pattern = /^ {8}- '(.*)'$/m.exec(guide)?.[1];
  if (pattern === undefined) throw new Error(`${GUIDE_PATHS[audience]} has no detection pattern`);
  return new RegExp(pattern.replaceAll("''", "'"));
}

describe.each(['app', 'extension'] as const)('the %s detection', (audience) => {
  const detects = (content: string) => detection(audience).test(content);

  it.each([
    ['a one-line call', 'orm({ runtime, context, collections: { Post: PostCollection } })'],
    [
      'a multi-line call',
      'return orm({\n  runtime,\n  context,\n  collections: {\n    User: UserCollection,\n  },\n}).public;',
    ],
    ['a call with type arguments', 'orm<Contract, Classes>({ runtime, context, collections })'],
  ])('finds %s', (_name, content) => {
    expect(detects(content)).toBe(true);
  });

  it.each([
    ['the client option', 'postgres({ contract, url, collections: { Post: PostCollection } })'],
    ['an ORM without classes', 'orm({ runtime, context })'],
    ['another function', 'mongoOrm({ contract, collections })'],
    ['a method of the same name', 'factory.orm({ runtime, context, collections })'],
  ])('skips %s', (_name, content) => {
    expect(detects(content)).toBe(false);
  });
});
