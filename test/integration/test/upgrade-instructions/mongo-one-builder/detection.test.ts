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

describe.each(['app', 'extension'])('the %s mongo-one-builder detection', (audience) => {
  const matches = (id: string, content: string) =>
    patternsOf(audience, id).some((pattern) => pattern.test(content));

  it('matches a model with a discriminator, and not one without', () => {
    expect([
      matches('mongo-ts-polymorphism-rules', "discriminator: { field: 'type', variants: {} },"),
      matches('mongo-ts-polymorphism-rules', "model('User', { collection: 'users', fields: {} })"),
    ]).toEqual([true, false]);
  });

  it('matches the index shapes the builder now refuses, and not a plain index', () => {
    expect([
      matches('mongo-index-shape-rules', "index({ '$**': 1 }, { unique: true })"),
      matches('mongo-index-shape-rules', "index({ a: 'hashed', b: 1 })"),
      matches('mongo-index-shape-rules', 'index({ a: 1 }, { wildcardProjection: { b: 1 } })'),
      matches('mongo-index-shape-rules', 'index({ a: 1 }, { collation: { strength: 2 } })'),
      matches('mongo-index-shape-rules', '@@index([wildcard(metadata)], expireAfterSeconds: 60)'),
      matches('mongo-index-shape-rules', 'index({ email: 1 }, { unique: true })'),
    ]).toEqual([true, true, true, true, true, false]);
  });
});
