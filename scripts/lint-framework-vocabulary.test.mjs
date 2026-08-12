import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execPath } from 'node:process';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  findMatchingLines,
  isScannableFile,
  lineMatchesTermTokens,
  tokenize,
} from './lint-framework-vocabulary.mjs';

const SCRIPT_PATH = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'lint-framework-vocabulary.mjs',
);

const CONFIG = {
  scopes: [
    {
      path: 'framework',
      forbidden: ['nativeType', 'postgres'],
      threshold: 0,
    },
  ],
};

// One matching line (nativeType), on line 2.
const FILE_WITH_ONE_HIT = 'export const x = 1;\nexport const nativeType = "int4";\n';

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

function writeConfig(config) {
  writeRepoFile('scripts/lint-framework-vocabulary.config.json', JSON.stringify(config, null, 2));
}

function commitAll(message) {
  git('add', '-A');
  git('commit', '-m', message);
}

function runScript(...args) {
  return spawnSync(execPath, [SCRIPT_PATH, ...args], { cwd: repo, encoding: 'utf-8' });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pn-lint-framework-vocab-'));
  git('init', '--quiet', '--initial-branch=main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false');
  writeConfig(CONFIG);
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('isScannableFile', () => {
  it('accepts .ts and .tsx source files', () => {
    assert.equal(isScannableFile('framework/src/foo.ts'), true);
    assert.equal(isScannableFile('framework/src/foo.tsx'), true);
  });

  it('rejects non ts/tsx files', () => {
    assert.equal(isScannableFile('framework/src/foo.js'), false);
    assert.equal(isScannableFile('framework/README.md'), false);
  });

  it('rejects test files and dirs', () => {
    assert.equal(isScannableFile('framework/src/foo.test.ts'), false);
    assert.equal(isScannableFile('framework/src/foo.test-d.ts'), false);
    assert.equal(isScannableFile('framework/src/foo.test.tsx'), false);
    assert.equal(isScannableFile('framework/src/foo.test-d.tsx'), false);
    assert.equal(isScannableFile('framework/test/foo.ts'), false);
    assert.equal(isScannableFile('framework/src/test/foo.ts'), false);
  });

  it('rejects dist output', () => {
    assert.equal(isScannableFile('framework/dist/foo.ts'), false);
  });
});

describe('token matcher — rejects substring noise', () => {
  it('does not match "table" inside "abortable"', () => {
    const scope = { forbidden: ['table', 'rls'] };
    const content = 'const unlessAborted = abortable(signal);\n';
    assert.deepEqual(findMatchingLines(content, scope), []);
  });

  it('does not match "rls" inside "urls"', () => {
    const scope = { forbidden: ['table', 'rls'] };
    const content = 'const urls: string[] = [];\n';
    assert.deepEqual(findMatchingLines(content, scope), []);
  });
});

describe('token matcher — catches camelCase leaks', () => {
  it('matches "column" against the plural in "parentColumns"', () => {
    const scope = { forbidden: ['column'] };
    const content = 'readonly parentColumns: readonly string[];\n';
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].terms, ['column']);
  });

  it('matches "nativeType" against the camelCase hump in "getNativeType"', () => {
    const scope = { forbidden: ['nativeType'] };
    const content = 'function getNativeType() {}\n';
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
  });

  it('matches "mongo" against the camelCase hump in "MongoStorage"', () => {
    const scope = { forbidden: ['mongo'] };
    const content = 'export class MongoStorage {}\n';
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
  });
});

describe('token matcher — distinct-line counting', () => {
  it('counts a line matching two terms once', () => {
    const scope = { forbidden: ['native-type', 'postgres'] };
    const content = 'export const postgresNativeType = "int4";\n';
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].terms.sort(), ['native-type', 'postgres']);
  });

  it('counts a line matching two forms of the same concept once', () => {
    const scope = { forbidden: ['primaryKey', 'primary key'] };
    const content = 'readonly primaryKey: string;\n';
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].terms.sort(), ['primary key', 'primaryKey']);
  });
});

describe('allow shielding', () => {
  it('shields a forbidden token whose range is covered by an allowed compound', () => {
    const scope = { forbidden: ['table'], allow: ['SymbolTable'] };
    assert.deepEqual(findMatchingLines('const t: SymbolTable = x;\n', scope), []);
    assert.deepEqual(findMatchingLines('import { X } from "./symbol-table";\n', scope), []);
  });

  it('still counts a bare forbidden token elsewhere', () => {
    const scope = { forbidden: ['table'], allow: ['SymbolTable'] };
    const matches = findMatchingLines('interface Table { id: string }\n', scope);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].terms, ['table']);
  });

  it('counts a bare forbidden token on a line that also has an allowed compound', () => {
    const scope = { forbidden: ['table'], allow: ['SymbolTable'] };
    const matches = findMatchingLines('const s: SymbolTable = table;\n', scope);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].terms, ['table']);
  });
});

describe('ignore comments', () => {
  const scope = { forbidden: ['table', 'column'] };
  const marker = '// framework-vocabulary-ignore: terminal rendering';

  it('exempts the line carrying a trailing marker', () => {
    const content = `return { kind: "table", columns }; ${marker}\n`;
    assert.deepEqual(findMatchingLines(content, scope), []);
  });

  it('exempts the line below a marker on its own line', () => {
    assert.deepEqual(findMatchingLines(`${marker}\nreturn { kind: "table" };\n`, scope), []);
  });

  it('never counts the marker line itself, even when the reason names forbidden terms', () => {
    const content = '// framework-vocabulary-ignore: a terminal table, not a table\nconst x = 1;\n';
    assert.deepEqual(findMatchingLines(content, scope), []);
  });

  it('exempts only the line immediately below the marker', () => {
    const content = `${marker}\nconst a: Table = x;\nconst b: Table = y;\n`;
    const matches = findMatchingLines(content, scope);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].line, 3);
  });

  it('does not suppress when the marker carries no reason', () => {
    const content = 'const a: Table = x; // framework-vocabulary-ignore\n';
    assert.equal(findMatchingLines(content, scope).length, 1);
  });

  it('does not suppress when the reason is only whitespace', () => {
    const content = 'const a: Table = x; // framework-vocabulary-ignore:   \n';
    assert.equal(findMatchingLines(content, scope).length, 1);
  });

  it('reports suppressed lines separately from the count', () => {
    const line = 'const n = nativeType; // framework-vocabulary-ignore: vendored name\n';
    writeRepoFile('framework/src/a.ts', line);
    commitAll('add suppressed hit');
    const result = runScript();
    assert.equal(result.status, 0);
    assert.match(result.stdout, /count=0 threshold=0 suppressed=1/);
  });
});

describe('tokenize', () => {
  it('splits camelCase, digit humps, and non-alphanumerics into lowercase tokens', () => {
    assert.deepEqual(tokenize('getNativeType()'), ['get', 'native', 'type']);
    assert.deepEqual(tokenize('foo-bar_baz.qux'), ['foo', 'bar', 'baz', 'qux']);
  });
});

describe('lineMatchesTermTokens', () => {
  it('matches a multi-token term as a consecutive subsequence', () => {
    assert.equal(lineMatchesTermTokens(['a', 'foreign', 'key', 'b'], ['foreign', 'key']), true);
  });

  it('does not match out-of-order tokens', () => {
    assert.equal(lineMatchesTermTokens(['key', 'foreign'], ['foreign', 'key']), false);
  });
});

describe('lint-framework-vocabulary — threshold met', () => {
  it('exits 0 when count equals threshold', () => {
    writeConfig({
      scopes: [{ path: 'framework', forbidden: ['nativeType', 'postgres'], threshold: 1 }],
    });
    writeRepoFile('framework/src/app.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 1');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /count=1 threshold=1/);
  });
});

describe('lint-framework-vocabulary — count above threshold', () => {
  it('exits 1 and instructs removing violations or raising the threshold', () => {
    writeConfig({
      scopes: [{ path: 'framework', forbidden: ['nativeType', 'postgres'], threshold: 0 }],
    });
    writeRepoFile('framework/src/app.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 0');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /count=1 threshold=0/);
    assert.match(result.stderr, /raise.*threshold|remove/i);
  });
});

describe('lint-framework-vocabulary — count below threshold', () => {
  it('exits 1 and instructs lowering the threshold', () => {
    writeConfig({
      scopes: [{ path: 'framework', forbidden: ['nativeType', 'postgres'], threshold: 5 }],
    });
    writeRepoFile('framework/src/app.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 5');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /count=1 threshold=5/);
    assert.match(result.stderr, /lower.*threshold/i);
  });
});

describe('lint-framework-vocabulary — scope boundary', () => {
  it('does not count a matching file outside the scanned scope', () => {
    writeConfig({
      scopes: [{ path: 'framework', forbidden: ['nativeType', 'postgres'], threshold: 0 }],
    });
    writeRepoFile('other/src/app.ts', FILE_WITH_ONE_HIT);
    commitAll('hit outside scope');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /count=0 threshold=0/);
  });
});

describe('lint-framework-vocabulary — exclusions', () => {
  it('ignores occurrences in test files and dist output', () => {
    writeConfig({
      scopes: [{ path: 'framework', forbidden: ['nativeType', 'postgres'], threshold: 0 }],
    });
    writeRepoFile('framework/src/app.test.ts', FILE_WITH_ONE_HIT);
    writeRepoFile('framework/src/app.test-d.ts', FILE_WITH_ONE_HIT);
    writeRepoFile('framework/test/app.ts', FILE_WITH_ONE_HIT);
    writeRepoFile('framework/dist/app.ts', FILE_WITH_ONE_HIT);
    commitAll('excluded-only occurrences');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /count=0 threshold=0/);
  });
});
