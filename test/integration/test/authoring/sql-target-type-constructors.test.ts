import { readdirSync, readFileSync } from 'node:fs';
import { sqlTargetTypeConstructors } from '@internal/family-sql/pack';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const targetsDirectory = join(import.meta.dirname, '../../../../packages/3-targets/3-targets');

const targetPackageNames = readdirSync(targetsDirectory).map((directory): string => {
  const manifest: { readonly name: string } = JSON.parse(
    readFileSync(join(targetsDirectory, directory, 'package.json'), 'utf8'),
  );
  return manifest.name;
});

interface TargetComponent {
  readonly familyId?: string;
  readonly authoring?: { readonly type?: { readonly sql?: Record<string, unknown> } };
}

async function sqlTargetComponents(entryPoint: 'pack' | 'control') {
  const components = await Promise.all(
    targetPackageNames.map(async (name) => {
      const module: { readonly default: TargetComponent } = await import(`${name}/${entryPoint}`);
      return { name, component: module.default };
    }),
  );
  return components.filter(({ component }) => component.familyId === 'sql');
}

describe.each(['pack', 'control'] as const)('every SQL target %s', (entryPoint) => {
  it('contributes sql.String, built by sqlTargetTypeConstructors', async () => {
    const targets = await sqlTargetComponents(entryPoint);
    expect(targets.map(({ name }) => name).sort()).toEqual([
      '@internal/target-postgres',
      '@internal/target-sqlite',
    ]);
    for (const { component } of targets) {
      const string = component.authoring?.type?.sql?.['String'];
      const built = sqlTargetTypeConstructors({ sizeType: 'unused' }).sql.String;
      expect(string).toMatchObject({ kind: built.kind, output: built.output });
    }
  });
});
