import { readdirSync, readFileSync } from 'node:fs';
import { sqlTargetTypeConstructors } from '@internal/family-sql/pack';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

const databasesDirectory = join(import.meta.dirname, '../../../../packages/3-targets');

const targetPackageNames = readdirSync(databasesDirectory).map((database): string => {
  const manifest: { readonly name: string } = JSON.parse(
    readFileSync(join(databasesDirectory, database, '1-target', 'package.json'), 'utf8'),
  );
  return manifest.name;
});

interface TargetComponent {
  readonly familyId?: string;
  readonly authoring?: { readonly type?: { readonly sql?: Record<string, unknown> } };
}

async function targetComponents(names: readonly string[], entryPoint: 'pack' | 'control') {
  return Promise.all(
    names.map(async (name) => {
      const module: { readonly default: TargetComponent } = await import(`${name}/${entryPoint}`);
      return { name, component: module.default };
    }),
  );
}

async function sqlTargetComponents(entryPoint: 'pack' | 'control') {
  const packs = await targetComponents(targetPackageNames, 'pack');
  const sqlTargetNames = packs
    .filter(({ component }) => component.familyId === 'sql')
    .map(({ name }) => name);
  return targetComponents(sqlTargetNames, entryPoint);
}

describe.each(['pack', 'control'] as const)('every SQL target %s', (entryPoint) => {
  it.each(['String', 'Char'] as const)(
    'contributes sql.%s, built by sqlTargetTypeConstructors',
    async (name) => {
      const targets = await sqlTargetComponents(entryPoint);
      expect(targets.map(({ name }) => name).sort()).toEqual([
        '@internal/target-postgres',
        '@internal/target-sqlite',
      ]);
      for (const { component } of targets) {
        const contributed = component.authoring?.type?.sql?.[name];
        const built = sqlTargetTypeConstructors({ sizeType: 'unused' }).sql[name];
        expect(contributed).toMatchObject({ kind: built.kind, output: built.output });
      }
    },
  );
});
