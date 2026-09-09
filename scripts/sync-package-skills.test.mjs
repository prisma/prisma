import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { SKILL_ANCHOR_PACKAGES, SKILL_NAMES, syncPackageSkills } from './sync-package-skills.ts';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGE_NAME = '@prisma/orm-postgres';
const skillsDir = join(repoRoot, SKILL_ANCHOR_PACKAGES.get(PACKAGE_NAME), 'skills');

function filesUnder(dir) {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .filter((entry) => statSync(join(dir, entry)).isFile())
    .sort();
}

test('sync copies every skill tree verbatim and stamps the shipping package', async () => {
  const destinations = await syncPackageSkills(PACKAGE_NAME);
  assert.deepEqual(
    destinations,
    SKILL_NAMES.map((name) => join(skillsDir, name)),
  );

  for (const skillName of SKILL_NAMES) {
    const sourceDir = join(repoRoot, 'skills', skillName);
    const destDir = join(skillsDir, skillName);
    assert.deepEqual(filesUnder(destDir), filesUnder(sourceDir), `${skillName} file list differs`);
    for (const file of filesUnder(sourceDir)) {
      if (file === 'SKILL.md') continue;
      assert.equal(
        readFileSync(join(destDir, file), 'utf-8'),
        readFileSync(join(sourceDir, file), 'utf-8'),
        `${skillName}/${file} differs from source`,
      );
    }
  }

  const stamped = readFileSync(join(skillsDir, SKILL_NAMES[0], 'SKILL.md'), 'utf-8');
  assert.match(stamped, new RegExp(`library:\\s*'${PACKAGE_NAME}'`));
});

test('an unknown package is rejected, naming the packages that do ship skills', async () => {
  await assert.rejects(
    () => syncPackageSkills('@prisma/orm-framework'),
    /Unknown skill-anchor package "@prisma\/orm-framework".*ship only from/s,
  );
});
