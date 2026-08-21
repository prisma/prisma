/**
 * The `prisma-8` agent skill ships inside the tarball of every package an
 * application depends on directly, so the skill a user has always describes
 * the version they installed. Nothing keeps a second copy in the source tree:
 * each facade's `prepack` runs `scripts/sync-package-skills.ts`, and `files`
 * carries the result into the tarball.
 *
 * This test runs that same command and checks what it leaves behind, which is
 * what `npm pack` collects.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { publicShells, type ShellName } from '../src/shells';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const syncScript = join(repoRoot, 'scripts', 'sync-package-skills.ts');
const facades: ShellName[] = ['@prisma/orm-postgres', '@prisma/orm-sqlite', '@prisma/orm-mongo'];

interface Manifest {
  readonly version: string;
  readonly files?: readonly string[];
  readonly scripts?: Readonly<Record<string, string>>;
}

function packageDir(facade: ShellName): string {
  const shell = publicShells.get(facade);
  if (shell === undefined) throw new Error(`unknown shell ${facade}`);
  return join(repoRoot, shell.dir);
}

function manifestOf(facade: ShellName): Manifest {
  const manifest: Manifest = JSON.parse(
    readFileSync(join(packageDir(facade), 'package.json'), 'utf8'),
  );
  return manifest;
}

function frontmatterValue(skillMd: string, key: string): string | undefined {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMd)?.[1];
  if (frontmatter === undefined) return undefined;
  const value = new RegExp(`^${key}: *(.+)$`, 'm').exec(frontmatter)?.[1];
  return value?.trim().replace(/^['"]|['"]$/g, '');
}

describe('the skill source in the repository', () => {
  it('carries the stamp the version sweep maintains', () => {
    const rootVersion: string = JSON.parse(
      readFileSync(join(repoRoot, 'package.json'), 'utf8'),
    ).version;
    const source = readFileSync(join(repoRoot, 'skills', 'prisma-8', 'SKILL.md'), 'utf8');
    expect(frontmatterValue(source, 'library_version')).toBe(rootVersion);
  });
});

describe.each(facades)('%s', (facade) => {
  it('publishes the skills directory', () => {
    expect(manifestOf(facade).files).toContain('skills');
  });

  it('refreshes the skill tree on prepack', () => {
    expect(manifestOf(facade).scripts?.['prepack']).toContain(`sync-package-skills.ts ${facade}`);
  });

  it('lands a stamped skill tree naming this package', () => {
    execFileSync('node', [syncScript, facade], { cwd: repoRoot, stdio: 'pipe' });

    const skillDir = join(packageDir(facade), 'skills', 'prisma-8');
    const skillMd = readFileSync(join(skillDir, 'SKILL.md'), 'utf8');
    expect(frontmatterValue(skillMd, 'library')).toBe(facade);
    expect(frontmatterValue(skillMd, 'library_version')).toBe(manifestOf(facade).version);
    expect(existsSync(join(skillDir, 'references', 'queries.md'))).toBe(true);
    expect(existsSync(join(skillDir, 'references', 'upgrade-app.md'))).toBe(true);
    expect(
      existsSync(join(skillDir, 'upgrading', 'app', 'upgrades', '0.7-to-0.8', 'instructions.md')),
    ).toBe(true);
  });
});
