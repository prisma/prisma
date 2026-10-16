import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

interface Change {
  readonly id: string;
  readonly patterns: readonly RegExp[];
}

function changesOf(fragment: string): readonly Change[] {
  const guide = readFileSync(
    join(repoRoot, 'upgrade-instructions/pending', fragment, 'app/instructions.md'),
    'utf-8',
  );
  return guide
    .split(/\n {2}- id: /)
    .slice(1)
    .map((block) => ({
      id: block.slice(0, block.indexOf('\n')),
      patterns: [...block.matchAll(/^ {8}- '(.*)'$/gm)].map(
        ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
      ),
    }));
}

function opsJsonChanges(fragment: string): readonly Change[] {
  return changesOf(fragment).filter(
    ({ id }) => id !== 'postgres-alter-column-type-unchanged-refused',
  );
}

const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf-8');

const writtenBefore = fixture('written-before.ops.json');
const writtenNow = [
  fixture('written-now.ops.json'),
  readFileSync(
    join(repoRoot, 'test/integration/test/planner-golden/fixtures/postgres/planned.golden.json'),
    'utf-8',
  ),
  ...['prisma-8-demo', 'prisma-8-postgis-demo'].flatMap((example) => {
    const root = join(repoRoot, 'examples', example, 'migrations/app');
    return readdirSync(root).map((migration) =>
      readFileSync(join(root, migration, 'ops.json'), 'utf-8'),
    );
  }),
];

function matchedBy(changes: readonly Change[], content: string): readonly string[] {
  return changes
    .filter(({ patterns }) => patterns.some((p) => p.test(content)))
    .map(({ id }) => id);
}

describe.each([
  'postgres-postchecks-check-full-definition',
  'postgres-autoincrement-sequence-follows-column-type',
])('%s detection', (fragment) => {
  const changes = opsJsonChanges(fragment);

  it('finds each operation an earlier release wrote', () => {
    expect(matchedBy(changes, writtenBefore)).toEqual(changes.map(({ id }) => id));
  });

  it('skips every ops.json this release writes', () => {
    expect(writtenNow.flatMap((content) => matchedBy(changes, content))).toEqual([]);
  });
});

describe('postgres-alter-column-type-unchanged-refused detection', () => {
  const [change] = changesOf('postgres-postchecks-check-full-definition').filter(
    ({ id }) => id === 'postgres-alter-column-type-unchanged-refused',
  );

  it('finds a hand-written alterColumnType with using, and skips one without', () => {
    const detects = (source: string) => change?.patterns.some((p) => p.test(source));
    expect([
      detects(
        "this.alterColumnType({ schema: 'public', table: 'user', column: 'email', type: 'text', using: 'lower(email)' })",
      ),
      detects(
        "this.alterColumnType({ schema: 'public', table: 'user', column: 'age', type: 'int8' })",
      ),
    ]).toEqual([true, false]);
  });
});
