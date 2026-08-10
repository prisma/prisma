import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { findViolations, main } from './lint-control-bytes.mjs';

/**
 * Assembled rather than written out: a fixture holding the literal byte would
 * be flagged by this very check when it runs over the repository.
 */
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

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

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'lint-control-bytes-'));
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('findViolations', () => {
  test('names the file, line and byte of a raw NUL', () => {
    write('src/keys.ts', `const a = 1;\nconst key = \`\${table}${NUL}\${name}\`;\n`);
    git('add', '-A');

    assert.deepEqual(findViolations(repo), [{ file: 'src/keys.ts', line: 2, byte: '0x00' }]);
  });

  test('catches the rest of the control range, not just NUL', () => {
    write('test/serialize.ts', `expect(serialize('a${BEL}b'));\n`);
    git('add', '-A');

    assert.equal(findViolations(repo)[0]?.byte, '0x07');
  });

  test('leaves an escaped control character alone', () => {
    write('src/escaped.ts', 'const key = `${table}\\u0000${name}`;\n');
    git('add', '-A');

    assert.deepEqual(findViolations(repo), []);
  });

  test('allows tab, line feed and carriage return', () => {
    write('src/whitespace.ts', 'const rows = [\n\t1,\r\n\t2,\n];\n');
    git('add', '-A');

    assert.deepEqual(findViolations(repo), []);
  });

  test('skips formats whose bytes are not text', () => {
    write('assets/logo.png', `\x89PNG\r\n${NUL}fixture`);
    git('add', '-A');

    assert.deepEqual(findViolations(repo), []);
  });
});

describe('main(scanDir)', () => {
  test('fails on a tree holding a raw control byte', () => {
    write('src/keys.ts', `const key = \`\${table}${NUL}\${name}\`;\n`);
    git('add', '-A');

    assert.equal(main(repo), 1);
  });

  test('passes on a tree that writes them as escapes', () => {
    write('src/escaped.ts', "export const bell = '\\u0007';\n");
    git('add', '-A');

    assert.equal(main(repo), 0);
  });
});
