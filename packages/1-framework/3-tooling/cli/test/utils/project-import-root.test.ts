import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectSpecifierResolver,
  projectImportRoot,
} from '../../src/utils/project-import-root';

let project: string;

function writeManifest(dependencies: Record<string, string>): string {
  const configPath = join(project, 'prisma-next.config.ts');
  writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'app', dependencies }));
  writeFileSync(configPath, 'export default {};');
  return configPath;
}

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), 'pn-project-import-root-'));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe('projectImportRoot', () => {
  it('reads the facade the project installed', () => {
    const configPath = writeManifest({ '@prisma/orm-postgres': '0.16.0' });

    expect(projectImportRoot(configPath)).toEqual({
      mode: 'facade',
      facade: '@prisma/orm-postgres',
    });
  });

  it('stays on the internal root for a project that names only workspace packages', () => {
    const configPath = writeManifest({ '@prisma-next/postgres': 'workspace:0.16.0' });

    expect(projectImportRoot(configPath)).toEqual({ mode: 'internal' });
  });

  it('finds the manifest above a config in a subdirectory', () => {
    writeManifest({ '@prisma/orm-mongo': '0.16.0' });
    const nested = join(project, 'prisma', 'nested');
    mkdirSync(nested, { recursive: true });

    expect(projectImportRoot(join(nested, 'prisma-next.config.ts'))).toEqual({
      mode: 'facade',
      facade: '@prisma/orm-mongo',
    });
  });
});

describe('createProjectSpecifierResolver', () => {
  it('rewrites emitted specifiers to the facade the project installed', () => {
    const configPath = writeManifest({ '@prisma/orm-postgres': '0.16.0' });
    const resolve = createProjectSpecifierResolver(configPath);

    expect(resolve('@prisma-next/contract/types')).toBe('@prisma/orm-postgres/contract/types');
    expect(resolve('@prisma-next/sql-contract/types')).toBe(
      '@prisma/orm-postgres/family-contract/types',
    );
  });

  it('leaves specifiers alone for a project on the internal root', () => {
    const configPath = writeManifest({ '@prisma-next/postgres': 'workspace:0.16.0' });
    const resolve = createProjectSpecifierResolver(configPath);

    expect(resolve('@prisma-next/contract/types')).toBe('@prisma-next/contract/types');
  });
});
