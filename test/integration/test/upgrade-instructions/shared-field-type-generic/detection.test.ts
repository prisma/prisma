import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATH =
  'skills/prisma-8/upgrading/app/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md';

const here = dirname(fileURLToPath(import.meta.url));

function detects(id: string, content: string): boolean {
  const guide = readFileSync(join(here, '../../../../..', GUIDE_PATH), 'utf-8');
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The app guide has no change ${id}`);
  return [...entry.matchAll(/^ {8}- '(.*)'$/gm)]
    .map(([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")))
    .some((pattern) => pattern.test(content));
}

describe.each([
  '@prisma/orm-mongo/contract-builder',
  '@prisma/orm-family-mongo/contract-ts/contract-builder',
])('Mongo defineContract detection through %s', (entry) => {
  it('finds a list field', () => {
    expect(
      detects(
        'mongo-define-contract-readonly-rows',
        `import { defineContract, field, model } from '${entry}';\nconst User = model('User', { fields: { tags: field.string().many() } });`,
      ),
    ).toBe(true);
  });

  it('finds the factory form', () => {
    expect(
      detects(
        'mongo-define-contract-factory-field-types',
        `import { defineContract } from '${entry}';\nexport const contract = defineContract(scaffold, ({ field, model }) => ({ models: {} }));`,
      ),
    ).toBe(true);
  });
});

describe('Mongo defineContract detection', () => {
  it('skips a SQL contract builder', () => {
    expect(
      detects(
        'mongo-define-contract-readonly-rows',
        "import { defineContract, field } from '@prisma/orm-postgres/contract-builder';\nconst tags = field.text().many();",
      ),
    ).toBe(false);
  });
});
