import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const familyPackage = ['@prisma', 'orm-family-mongo'].join('/');
const facadePackage = ['@prisma', 'orm-mongo'].join('/');

function detects(audience: 'app' | 'extension', id: string, content: string): boolean {
  const path = `upgrade-instructions/pending/mongo-query-validates-contract/${audience}/instructions.md`;
  const guide = readFileSync(join(repoRoot, path), 'utf-8');
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The ${audience} guide has no change ${id}`);
  const patterns = [...entry.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
  if (patterns.length === 0) throw new Error(`The ${audience} change ${id} has no detection`);
  return patterns.some((pattern) => pattern.test(content));
}

describe('the app mongoQuery detection', () => {
  const id = 'mongo-query-validates-contract';

  it.each([
    ['a call', 'const query = mongoQuery({ contract });'],
    ['a call with a space', 'mongoQuery ({ contract })'],
    ['an aliased import', `import { mongoQuery as query } from '${facadePackage}/query-builder';`],
    [
      'an import from the family package',
      `import { acc, mongoQuery } from '${familyPackage}/query-builder';`,
    ],
    [
      'a call through a namespace import of the facade',
      `import * as builder from '${facadePackage}/query-builder';\nconst q = builder.mongoQuery({ contract });`,
    ],
    [
      'a call through a namespace import of the family package',
      `import * as qb from '${familyPackage}/query-builder';\nqb.mongoQuery({ contract });`,
    ],
  ])('finds %s', (_name, content) => {
    expect(detects('app', id, content)).toBe(true);
  });

  it.each([
    ['a method of the same name', 'db.mongoQuery({ contract })'],
    ['a longer name', 'myMongoQuery({ contract })'],
    ['an import of other names', `import { acc } from '${familyPackage}/query-builder';`],
    [
      'a member call on another namespace',
      `import * as builder from '${facadePackage}/query-builder';\nother.mongoQuery({ contract });`,
    ],
  ])('skips %s', (_name, content) => {
    expect(detects('app', id, content)).toBe(false);
  });
});

describe('the extension mongoQuery detection', () => {
  const id = 'family-query-builder-drops-mongo-query';

  it.each([
    [
      'an import from the family package',
      `import { mongoQuery } from '${familyPackage}/query-builder';`,
    ],
    [
      'an aliased import from the family package',
      `import { mongoQuery as query } from '${familyPackage}/query-builder';`,
    ],
    [
      'an import from the internal package',
      "import { mongoQuery } from '@internal/mongo-query-builder';",
    ],
    [
      'a namespace import of the family package',
      `import * as builder from '${familyPackage}/query-builder';`,
    ],
  ])('finds %s', (_name, content) => {
    expect(detects('extension', id, content)).toBe(true);
  });

  it.each([
    ['an import from the facade', `import { mongoQuery } from '${facadePackage}/query-builder';`],
    [
      'a namespace import of the facade',
      `import * as builder from '${facadePackage}/query-builder';`,
    ],
    ['an import of other names', `import { acc } from '${familyPackage}/query-builder';`],
  ])('skips %s', (_name, content) => {
    expect(detects('extension', id, content)).toBe(false);
  });
});
