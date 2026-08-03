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
    write('src/db.ts', "import { orm } from '@prisma-next/sql-orm-client';\n");
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, /src\/db\.ts:1:/);
  });

  it('fails on a directory or package named after the old product', () => {
    write('examples/prisma-next-widget/package.json', '{ "name": "prisma-next-widget" }\n');
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, /prisma-next-widget/);
  });

  it('fails on a link to the old repository that names no PR or issue', () => {
    write('CONTRIBUTING.md', 'File issues at https://github.com/prisma/prisma-next/discussions.\n');
    const result = run();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stderr, /CONTRIBUTING\.md:1:/);
  });

  it('lists every allowance when it fails, so the reader can see which ones exist', () => {
    write('src/db.ts', "import x from '@prisma-next/contract';\n");
    const result = run();
    assert.match(result.stderr, /dated record of past work/);
    assert.match(result.stderr, /a name a user types/);
  });
});

describe('what the check allows', () => {
  it('passes a clean tree', () => {
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the changelog and the release notes', () => {
    write('CHANGELOG.md', 'Published as `@prisma-next/cli` in v0.16.0.\n');
    write('docs/releases/v0.16.0.md', 'Upgrade `@prisma-next/postgres` to 0.16.\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows ADRs and the project and drive write-ups', () => {
    write(
      'docs/architecture docs/adrs/ADR 211 - shim.md',
      'The `@prisma-next/cli` dist is copied.\n',
    );
    write('projects/some-project/spec.md', 'Depends on `@prisma-next/emitter`.\n');
    write('drive/retro/findings.md', 'The `prisma-next-ws` checkout was stale.\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows a link that names a pull request or issue by number', () => {
    write('docs/notes.md', 'Landed as [#1023](https://github.com/prisma/prisma-next/pull/1023).\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows a Linear URL whose generated slug carries the old name', () => {
    write(
      'docs/notes.md',
      'Tracked at [TML-2677](https://linear.app/prisma-company/issue/TML-2677/add-prisma-nextsqliteconfig-wrapper).\n',
    );
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the command, the config file, and the files the command writes', () => {
    write('docs/quickstart.md', 'Run `prisma-next init`, then edit `prisma-next.config.ts`.\n');
    write('app/package.json', '{ "scripts": { "emit": "prisma-next contract emit" } }\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the published skill cluster', () => {
    write('skills/prisma-next-queries/SKILL.md', 'name: prisma-next-queries\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('allows the roadmap narrating the move out of the old repository', () => {
    write('ROADMAP.md', 'Developed in a separate repository, `prisma/prisma-next`.\n');
    const result = run();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
  });

  it('names the roadmap task on each allowance that is meant to be temporary', () => {
    for (const line of ['prisma-next init', 'skills/prisma-next-queries/SKILL.md']) {
      const allowance = allowanceFor('docs/x.md', line) ?? allowanceFor(line, line);
      assert.match(allowance.why, /ROADMAP\.md § 3/);
    }
  });
});
