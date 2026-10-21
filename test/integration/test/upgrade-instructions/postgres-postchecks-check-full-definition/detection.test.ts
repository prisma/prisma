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

const GUIDE_PATH =
  'skills/prisma-8/upgrading/app/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md';

const FRAGMENT_CHANGES: Record<string, (id: string) => boolean> = {
  'postgres-postchecks-check-full-definition': (id) =>
    id.startsWith('postgres-postcheck-') || id === 'postgres-alter-column-type-unchanged-refused',
  'postgres-autoincrement-sequence-follows-column-type': (id) =>
    id === 'postgres-autoincrement-sequence-follows-column-type',
};

function changesOf(fragment: string): readonly Change[] {
  const belongs = FRAGMENT_CHANGES[fragment];
  if (belongs === undefined) throw new Error(`No changes listed for ${fragment}`);
  const guide = readFileSync(join(repoRoot, GUIDE_PATH), 'utf-8');
  return guide
    .split(/\n {2}- id: /)
    .slice(1)
    .map((block) => ({
      id: block.slice(0, block.indexOf('\n')),
      patterns: [...block.matchAll(/^ {8}- '(.*)'$/gm)].map(
        ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
      ),
    }))
    .filter(({ id }) => belongs(id));
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
