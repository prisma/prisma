import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execPath } from 'node:process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { allowanceFor } from './lint-legacy-name.mjs';

const SCRIPT_PATH = join(fileURLToPath(new URL('.', import.meta.url)), 'lint-legacy-name.mjs');

/**
 * The name this check forbids, assembled rather than written out.
 *
 * Every fixture below plants it on purpose. Spelled literally, a repo-wide
 * rename sweep would rewrite these the way it rewrites real code, and each
 * negative test would go on passing while asserting nothing. Same reason
 * `test/integration/test/cli-journeys/migration-new-import-root.e2e.test.ts`
 * builds its package names from constants.
 */
const LEGACY = ['prisma', 'next'].join('-');
const SCOPE = `@${LEGACY}/`;

let repo;

function git(...args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function write(relPath, content) {
  const full = join(repo, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function run() {
  git('add', '-A');
  git('commit', '-m', 'fixture');
  return spawnSync(execPath, [SCRIPT_PATH], { cwd: repo, encoding: 'utf-8' });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pn-lint-legacy-'));
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  write('README.md', 'Prisma 8\n');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('what the check forbids', () => {
  it('fails on the old package scope, naming the file and line', () => {
    write('src/db.ts', `import { orm } from '${SCOPE}sql-orm-client';\n`);
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, /src\/db\.ts:1:/);
  });

  it('fails on a directory or package named after the old product', () => {
    write(`examples/${LEGACY}-widget/package.json`, `{ "name": "${LEGACY}-widget" }\n`);
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, new RegExp(`${LEGACY}-widget`));
  });

  it('fails on a link to the old repository that names no PR or issue', () => {
    write('CONTRIBUTING.md', `File issues at https://github.com/prisma/${LEGACY}/discussions.\n`);
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, /CONTRIBUTING\.md:1:/);
  });

  it('lists every allowance when it fails, so the reader can see which ones exist', () => {
    write('src/db.ts', `import x from '${SCOPE}contract';\n`);
    const result = run();
    assert.match(result.stderr, /dated record of past work/);
    assert.match(result.stderr, /a name still written into user projects/);
  });
});

describe('what the check allows', () => {
  it('passes a clean tree', () => {
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the changelog and the release notes', () => {
    write('CHANGELOG.md', `Published as \`${SCOPE}cli\` in v0.16.0.\n`);
    write('docs/releases/v0.16.0.md', `Upgrade \`${SCOPE}postgres\` to 0.16.\n`);
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows ADRs and the project and drive write-ups', () => {
    write('docs/architecture docs/adrs/ADR 211 - shim.md', `The \`${SCOPE}cli\` dist is copied.\n`);
    write('projects/some-project/spec.md', `Depends on \`${SCOPE}emitter\`.\n`);
    write('drive/retro/findings.md', `The \`${LEGACY}-ws\` checkout was stale.\n`);
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows a link that names a pull request or issue by number', () => {
    write('docs/notes.md', `Landed as [#1023](https://github.com/prisma/${LEGACY}/pull/1023).\n`);
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows a Linear URL whose generated slug carries the old name', () => {
    write(
      'docs/notes.md',
      `Tracked at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-${LEGACY}sqliteconfig-wrapper).\n`,
    );
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the bare name and the files init writes, but never the retired config file', () => {
    write('docs/quickstart.md', `Open \`${LEGACY}.md\` for the quick reference.\n`);
    write('src/schema.prisma', `// use ${LEGACY}\n`);
    const clean = run();
    assert.equal(clean.status, 0, `expected exit 0; stderr=${clean.stderr}`);

    write('docs/stale.md', `Edit \`${LEGACY}.config.ts\`.\n`);
    const stale = run();
    assert.equal(stale.status, 1, 'expected the retired config filename to fail');
  });

  it('allows the published skill cluster', () => {
    write(`skills/${LEGACY}-queries/SKILL.md`, `name: ${LEGACY}-queries\n`);
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the roadmap narrating the move out of the old repository', () => {
    write('ROADMAP.md', `Developed in a separate repository, \`prisma/${LEGACY}\`.\n`);
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('names the roadmap task on each allowance that is meant to be temporary', () => {
    for (const line of [`${LEGACY} init`, `skills/${LEGACY}-queries/SKILL.md`]) {
      const allowance = allowanceFor('docs/x.md', line) ?? allowanceFor(line, line);
      assert.match(allowance.why, /ROADMAP\.md § 3/);
    }
  });
});
