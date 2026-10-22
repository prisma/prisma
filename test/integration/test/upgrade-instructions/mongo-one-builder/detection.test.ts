import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function patternsOf(audience: string, id: string): readonly RegExp[] {
  const guide = readFileSync(
    join(repoRoot, 'upgrade-instructions/pending/mongo-one-builder', audience, 'instructions.md'),
    'utf-8',
  );
  const block = guide.split(/\n {2}- id: /).find((entry) => entry.startsWith(`${id}\n`)) ?? '';
  return [...block.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

const mongoBuilderImport =
  "import { defineContract, field, index, model } from '@prisma/orm-mongo/contract-builder';\n";

/** An emitted SQL contract type, which names a discriminator, a collation and a hashed value without being a MongoDB contract. */
const sqlContractTypes =
  "import type { Contract } from '@prisma/orm-postgres/contract';\nexport type Models = { readonly Task: { readonly discriminator: { readonly field: 'type' }; readonly collation: 'C'; readonly kind: 'hashed' } };";

describe.each(['app', 'extension'])('the %s mongo-one-builder detection', (audience) => {
  const matches = (id: string, content: string) =>
    patternsOf(audience, id).some((pattern) => pattern.test(content));

  it('matches a MongoDB model with a discriminator, and not one without or a SQL contract', () => {
    expect([
      matches(
        'mongo-ts-polymorphism-rules',
        `${mongoBuilderImport}discriminator: { field: 'type', variants: {} },`,
      ),
      matches(
        'mongo-ts-polymorphism-rules',
        `${mongoBuilderImport}model('User', { collection: 'users', fields: {} })`,
      ),
      matches('mongo-ts-polymorphism-rules', sqlContractTypes),
    ]).toEqual([true, false, false]);
  });

  it('matches the index shapes the builder now refuses, and not a plain index or a SQL contract', () => {
    expect([
      matches(
        'mongo-index-shape-rules',
        `${mongoBuilderImport}index({ '$**': 1 }, { unique: true })`,
      ),
      matches('mongo-index-shape-rules', `${mongoBuilderImport}index({ a: 'hashed', b: 1 })`),
      matches(
        'mongo-index-shape-rules',
        `${mongoBuilderImport}index({ a: 1 }, { wildcardProjection: { b: 1 } })`,
      ),
      matches(
        'mongo-index-shape-rules',
        `${mongoBuilderImport}index({ a: 1 }, { collation: { strength: 2 } })`,
      ),
      matches('mongo-index-shape-rules', '@@index([wildcard(metadata)], expireAfterSeconds: 60)'),
      matches(
        'mongo-index-shape-rules',
        `${mongoBuilderImport}index({ email: 1 }, { unique: true })`,
      ),
      matches('mongo-index-shape-rules', sqlContractTypes),
    ]).toEqual([true, true, true, true, true, false, false]);
  });
});
