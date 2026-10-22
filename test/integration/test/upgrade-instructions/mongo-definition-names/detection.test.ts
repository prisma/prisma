import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function patternsOf(audience: string, id: string): readonly RegExp[] {
  const guide = readFileSync(
    join(
      repoRoot,
      'upgrade-instructions/pending/mongo-definition-names',
      audience,
      'instructions.md',
    ),
    'utf-8',
  );
  const block = guide.split(/\n {2}- id: /).find((entry) => entry.startsWith(`${id}\n`)) ?? '';
  return [...block.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

const published = (subpath: string) => `'${['@prisma', subpath].join('/')}'`;

describe.each(['app', 'extension'])('the %s mongo-definition-names detection', (audience) => {
  const matches = (id: string, content: string) =>
    patternsOf(audience, id).some((pattern) => pattern.test(content));

  it('matches ContractDefinition imported from a MongoDB contract builder until it is renamed', () => {
    expect([
      matches(
        'mongo-contract-input',
        `import type { ContractDefinition } from ${published('orm-mongo/contract-builder')};`,
      ),
      matches(
        'mongo-contract-input',
        `import {\n  type ContractDefinition,\n  defineContract,\n} from ${published('orm-family-mongo/contract-ts/contract-builder')};`,
      ),
      matches(
        'mongo-contract-input',
        `import type { ContractInput } from ${published('orm-mongo/contract-builder')};`,
      ),
    ]).toEqual([true, true, false]);
  });

  it('does not match SQL ContractDefinition', () => {
    expect(
      matches(
        'mongo-contract-input',
        `import type { ContractDefinition } from ${published('orm-postgres/contract-builder')};`,
      ),
    ).toBe(false);
  });

  it('matches MongoModelDefinition until it is replaced', () => {
    expect([
      matches(
        'mongo-model-definition-removed',
        `import type { MongoModelDefinition } from ${published('orm-mongo/family-contract')};`,
      ),
      matches(
        'mongo-model-definition-removed',
        'const model: ContractModel<MongoModelStorage> = user;',
      ),
    ]).toEqual([true, false]);
  });
});
