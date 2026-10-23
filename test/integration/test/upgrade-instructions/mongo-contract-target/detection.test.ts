import { describe, expect, it } from 'vitest';
import { detectionPatterns } from '../guide-detections';

function patternsOf(audience: string, id: string): readonly RegExp[] {
  return detectionPatterns(
    `upgrade-instructions/pending/mongo-contract-target/${audience}/instructions.md`,
    id,
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
      matches('mongoContract(schemaPath)'),
      matches("mongoContract(join(dir, 'schema.prisma'))"),
      matches("mongoContract(join(dir, 'schema.prisma'), { output: 'out' })"),
      matches("mongoContract('./schema.prisma', { target: mongoTargetPack })"),
      matches("mongoContract(join(dir, 'schema.prisma'), { target: mongoTargetPack })"),
      matches(
        "mongoContract(schemaPath, {\n  output: 'out/contract.json',\n  target: mongoTargetPack,\n})",
      ),
    ]).toEqual([true, true, true, true, true, true, false, false, false]);
  });

  it('does not match a call of another function that ends in mongoContract', () => {
    expect(matches("prisma6mongoContract('./schema.prisma')")).toBe(false);
  });
});
