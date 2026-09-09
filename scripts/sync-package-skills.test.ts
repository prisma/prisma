import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { syncSkillTree } from './sync-package-skills.ts';

const SKILL_MD = `---
name: demo
metadata:
  library: '@prisma/orm-postgres'
---
# demo
`;

function makeSource(root: string, files = 40): string {
  const source = join(root, 'source');
  mkdirSync(join(source, 'references', 'deep'), { recursive: true });
  writeFileSync(join(source, 'SKILL.md'), SKILL_MD);
  for (let index = 0; index < files; index++) {
    writeFileSync(join(source, 'references', 'deep', `file-${index}.md`), `body ${index}\n`);
  }
  return source;
}

function makePackage(root: string): string {
  const packageDir = join(root, 'package');
  mkdirSync(packageDir, { recursive: true });
  return packageDir;
}

function filesUnder(dir: string): readonly string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((entry) => statSync(join(dir, entry)).isFile())
    .sort();
}

function setup(): { source: string; packageDir: string; destination: string } {
  const root = mkdtempSync(join(tmpdir(), 'sync-package-skills-'));
  const source = makeSource(root);
  const packageDir = makePackage(root);
  return { source, packageDir, destination: join(packageDir, 'skills', 'prisma-8') };
}

function stampedFor(packageName: string): string {
  return SKILL_MD.replace("'@prisma/orm-postgres'", `'${packageName}'`);
}

describe('syncSkillTree', () => {
  it('copies the tree and stamps SKILL.md with the package name', async () => {
    const { source, destination } = setup();
    await syncSkillTree({ source, destination, packageName: '@prisma/orm-sqlite' });
    assert.deepEqual(filesUnder(destination), filesUnder(source));
    assert.equal(
      readFileSync(join(destination, 'SKILL.md'), 'utf-8'),
      stampedFor('@prisma/orm-sqlite'),
    );
  });

  it('leaves a matching copy untouched', async () => {
    const { source, destination } = setup();
    const sync = { source, destination, packageName: '@prisma/orm-sqlite' };
    await syncSkillTree(sync);
    const before = statSync(destination).ino;
    await syncSkillTree(sync);
    assert.equal(statSync(destination).ino, before);
  });

  it('replaces a stale copy', async () => {
    const { source, destination } = setup();
    mkdirSync(join(destination, 'old'), { recursive: true });
    writeFileSync(join(destination, 'old', 'stale.md'), 'stale\n');
    writeFileSync(join(destination, 'SKILL.md'), 'stale\n');
    await syncSkillTree({ source, destination, packageName: '@prisma/orm-mongo' });
    assert.deepEqual(filesUnder(destination), filesUnder(source));
    assert.equal(
      readFileSync(join(destination, 'SKILL.md'), 'utf-8'),
      stampedFor('@prisma/orm-mongo'),
    );
  });

  it('leaves no scratch directories behind', async () => {
    const { source, packageDir, destination } = setup();
    await syncSkillTree({ source, destination, packageName: '@prisma/orm-mongo' });
    await syncSkillTree({ source, destination, packageName: '@prisma/orm-mongo' });
    assert.deepEqual(readdirSync(packageDir), ['skills']);
  });

  it('survives concurrent syncs against the same destination', async () => {
    const { source, packageDir, destination } = setup();
    const sync = { source, destination, packageName: '@prisma/orm-postgres' };
    await Promise.all(Array.from({ length: 8 }, () => syncSkillTree(sync)));
    assert.deepEqual(filesUnder(destination), filesUnder(source));
    assert.equal(
      readFileSync(join(destination, 'SKILL.md'), 'utf-8'),
      stampedFor('@prisma/orm-postgres'),
    );
    assert.deepEqual(readdirSync(packageDir), ['skills']);
  });
});
