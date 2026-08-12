import { readFileSync } from 'node:fs';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(import.meta.dirname, '../../../../');

const GENERATED_ARTIFACT_ROOTS = [
  'examples/prisma-8-demo/src/prisma/contract.d.ts',
  'test/e2e/framework/test/fixtures/generated/contract.d.ts',
] as const;

describe('Generated contract.d.ts artifact shape', () => {
  for (const artifactPath of GENERATED_ARTIFACT_ROOTS) {
    const absolutePath = join(REPO_ROOT, artifactPath);
    describe(artifactPath, () => {
      it('exports separate TypeMaps', () => {
        const content = readFileSync(absolutePath, 'utf-8');
        expect(content).toMatch(/export type TypeMaps\s*=/);
      });

      it('does not contain legacy mappings type', () => {
        const content = readFileSync(absolutePath, 'utf-8');
        expect(content).not.toMatch(/\bmodelToTable\b/);
        expect(content).not.toMatch(/\btableToModel\b/);
        expect(content).not.toMatch(/\bfieldToColumn\b/);
        expect(content).not.toMatch(/\bcolumnToField\b/);
      });
    });
  }
});
