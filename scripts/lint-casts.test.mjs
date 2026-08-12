import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execPath } from 'node:process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { filterNoBarecastDiags } from './lint-casts.mjs';

const SCRIPT_PATH = join(fileURLToPath(new URL('.', import.meta.url)), 'lint-casts.mjs');

// A single bare `as` cast that the plugin recognises.
const FILE_WITH_CAST = 'declare const value: unknown;\nexport const x = value as string;\n';
// No `as` casts.
const FILE_WITHOUT_CAST = 'export const x = 1;\n';

let repo;

function git(...args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function writeRepoFile(relPath, content) {
  const full = join(repo, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function commitAll(message) {
  git('add', '-A');
  git('commit', '-m', message);
}

function setOriginMain(sha) {
  // Materialize refs/remotes/origin/main without needing a real remote.
  git('update-ref', 'refs/remotes/origin/main', sha);
}

function runScript() {
  return spawnSync(execPath, [SCRIPT_PATH], { cwd: repo, encoding: 'utf-8' });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pn-lint-casts-'));
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('filterNoBarecastDiags', () => {
  it('keeps plugin diagnostics with the no-bare-cast prefix', () => {
    const diags = [
      { category: 'plugin', message: 'no-bare-cast: bare `as` cast' },
      { category: 'lint', message: 'no-bare-cast: should be ignored' },
      { category: 'plugin', message: 'other-plugin: something else' },
    ];
    const kept = filterNoBarecastDiags(diags);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].category, 'plugin');
    assert.match(kept[0].message, /^no-bare-cast:/);
  });

  it('returns empty array when no diagnostics match', () => {
    assert.deepEqual(filterNoBarecastDiags([]), []);
    assert.deepEqual(filterNoBarecastDiags([{ category: 'lint', message: 'something' }]), []);
  });
});

describe('lint-casts — skip on main', () => {
  it('exits 0 and prints a skip message when HEAD is at merge-base', () => {
    writeRepoFile('src/app.ts', FILE_WITHOUT_CAST);
    commitAll('initial');
    setOriginMain(git('rev-parse', 'HEAD'));
    // HEAD == merge-base → should skip
    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /Skipping/i);
  });
});

describe('lint-casts — zero delta', () => {
  it('exits 0 and reports delta=0 when cast count is unchanged', () => {
    writeRepoFile('src/app.ts', FILE_WITH_CAST);
    commitAll('base: one cast');
    setOriginMain(git('rev-parse', 'HEAD'));

    writeRepoFile('src/other.ts', FILE_WITHOUT_CAST);
    commitAll('feature: add unrelated file');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /delta=0/);
  });
});

describe('lint-casts — negative delta', () => {
  it('exits 0 and reports a negative delta when a cast is removed', () => {
    writeRepoFile('src/app.ts', FILE_WITH_CAST);
    commitAll('base: one cast');
    setOriginMain(git('rev-parse', 'HEAD'));

    writeRepoFile('src/app.ts', FILE_WITHOUT_CAST);
    commitAll('feature: remove cast');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /delta=-1/);
  });
});

describe('lint-casts — positive delta', () => {
  it('exits 1 and prints added site(s) when a cast is introduced', () => {
    writeRepoFile('src/app.ts', FILE_WITHOUT_CAST);
    commitAll('base: no casts');
    setOriginMain(git('rev-parse', 'HEAD'));

    writeRepoFile('src/app.ts', FILE_WITH_CAST);
    commitAll('feature: add cast');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /delta=\+1/);
    assert.match(result.stderr, /no-bare-cast|as.*cast/i);
    assert.match(result.stderr, /blindCast|castAs/);
  });

  it('lists each new cast site with file:line', () => {
    writeRepoFile('src/app.ts', FILE_WITHOUT_CAST);
    commitAll('base: no casts');
    setOriginMain(git('rev-parse', 'HEAD'));

    writeRepoFile('src/app.ts', FILE_WITH_CAST);
    commitAll('feature: add cast');

    const result = runScript();
    assert.equal(result.status, 1);
    // The cast is on line 2 of FILE_WITH_CAST
    assert.match(result.stderr, /src\/app\.ts:2/);
  });
});

describe('lint-casts — worktree cleanup', () => {
  it('leaves no stray worktrees after a successful run', () => {
    writeRepoFile('src/app.ts', FILE_WITHOUT_CAST);
    commitAll('base');
    setOriginMain(git('rev-parse', 'HEAD'));
    writeRepoFile('src/other.ts', FILE_WITHOUT_CAST);
    commitAll('feature');

    runScript();

    const worktreeList = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: repo,
      encoding: 'utf-8',
    });
    // Only the main worktree should remain (one `worktree <path>` entry)
    const worktreeCount = worktreeList.split('\n').filter((l) => l.startsWith('worktree ')).length;
    assert.equal(worktreeCount, 1, `expected 1 worktree; got:\n${worktreeList}`);
  });
});
