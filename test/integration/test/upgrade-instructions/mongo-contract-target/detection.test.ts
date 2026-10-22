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
      'upgrade-instructions/pending/mongo-contract-target',
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

describe.each(['app', 'extension'])('the %s mongo-contract-target detection', (audience) => {
  const matches = (content: string) =>
    patternsOf(audience, 'mongo-contract-target-option').some((pattern) => pattern.test(content));

  it('matches a mongoContract call without a target until it passes one', () => {
    expect([
      matches("const contract = mongoContract('./prisma/schema.prisma');"),
      matches('mongoContract("./schema.prisma",)'),
      matches("mongoContract(schemaPath, { output: 'out/contract.json' })"),
      matches("mongoContract('./schema.prisma', { target: mongoTargetPack })"),
      matches(
        "mongoContract(schemaPath, {\n  output: 'out/contract.json',\n  target: mongoTargetPack,\n})",
      ),
    ]).toEqual([true, true, true, false, false]);
  });

  it('does not match a call of another function that ends in mongoContract', () => {
    expect(matches("prisma6mongoContract('./schema.prisma')")).toBe(false);
  });
});
