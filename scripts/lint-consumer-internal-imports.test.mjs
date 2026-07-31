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
  internalSpecifiersOnLine,
  isScannableFile,
  scanManifests,
} from './lint-consumer-internal-imports.mjs';

const SCRIPT_PATH = join(
  fileURLToPath(new URL('.', import.meta.url)),
  'lint-consumer-internal-imports.mjs',
);

const CONFIG = {
  scopes: [
    { path: 'examples', threshold: 0, manifestThreshold: 0 },
    { path: 'apps', threshold: 0, manifestThreshold: 0 },
  ],
};

// One matching line (the import), on line 2.
const FILE_WITH_ONE_HIT =
  "export const x = 1;\nimport { orm } from '@prisma-next/sql-orm-client';\n";

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
  writeRepoFile(
    'scripts/lint-consumer-internal-imports.config.json',
    JSON.stringify(config, null, 2),
  );
}

function commitAll(message) {
  git('add', '-A');
  git('commit', '-m', message);
}

function runScript(...args) {
  return spawnSync(execPath, [SCRIPT_PATH, ...args], { cwd: repo, encoding: 'utf-8' });
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'pn-lint-consumer-imports-'));
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
  it('accepts every module format a consumer ships', () => {
    for (const ext of ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']) {
      assert.equal(isScannableFile(`examples/app/src/main.${ext}`), true, ext);
    }
  });

  it('rejects files that are not modules', () => {
    assert.equal(isScannableFile('examples/app/contract.json'), false);
    assert.equal(isScannableFile('examples/app/README.md'), false);
  });

  it('accepts tests, configs, and generated files, which are consumer code too', () => {
    assert.equal(isScannableFile('examples/app/test/app.test.ts'), true);
    assert.equal(isScannableFile('examples/app/vitest.config.ts'), true);
    assert.equal(isScannableFile('examples/app/src/prisma/contract.d.ts'), true);
    assert.equal(isScannableFile('examples/app/migrations/app/x/migration.ts'), true);
  });

  it('rejects build output and installed dependencies', () => {
    assert.equal(isScannableFile('examples/app/dist/main.js'), false);
    assert.equal(isScannableFile('examples/app/node_modules/pkg/index.js'), false);
    assert.equal(isScannableFile('examples/app/coverage/report.js'), false);
  });
});

describe('internalSpecifiersOnLine', () => {
  it('reads a static import', () => {
    assert.deepEqual(
      internalSpecifiersOnLine("import { orm } from '@prisma-next/sql-orm-client';"),
      ['@prisma-next/sql-orm-client'],
    );
  });

  it('reads a side-effect import, a dynamic import, and a re-export', () => {
    assert.deepEqual(internalSpecifiersOnLine("import '@prisma-next/postgres/runtime';"), [
      '@prisma-next/postgres/runtime',
    ]);
    assert.deepEqual(
      internalSpecifiersOnLine("type X = import('@prisma-next/contract/types').C;"),
      ['@prisma-next/contract/types'],
    );
    assert.deepEqual(internalSpecifiersOnLine('export * from "@prisma-next/utils/casts";'), [
      '@prisma-next/utils/casts',
    ]);
  });

  it('ignores the published scope, relative paths, and third-party packages', () => {
    assert.deepEqual(internalSpecifiersOnLine("import x from '@prisma/orm-postgres/runtime';"), []);
    assert.deepEqual(internalSpecifiersOnLine("import x from './db';"), []);
    assert.deepEqual(internalSpecifiersOnLine("import { type } from 'arktype';"), []);
  });

  it('does not match the scope name outside an import position', () => {
    assert.deepEqual(internalSpecifiersOnLine("const name = '@prisma-next/postgres';"), []);
  });
});

describe('findMatchingLines', () => {
  it('reports the line number and the specifier', () => {
    const matches = findMatchingLines(FILE_WITH_ONE_HIT);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].line, 2);
    assert.deepEqual(matches[0].specifiers, ['@prisma-next/sql-orm-client']);
  });

  it('counts a line naming two internal specifiers once', () => {
    const content =
      "export { a } from '@prisma-next/utils/casts'; export { b } from '@prisma-next/ids';\n";
    const matches = findMatchingLines(content);
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0].specifiers, ['@prisma-next/utils/casts', '@prisma-next/ids']);
  });

  it('counts a multi-line import once, on the line that names the module', () => {
    const content = "import {\n  orm,\n  Collection,\n} from '@prisma-next/sql-orm-client';\n";
    const matches = findMatchingLines(content);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].line, 4);
  });
});

describe('scanManifests', () => {
  function manifest(relPath, fields) {
    writeRepoFile(relPath, JSON.stringify({ name: 'app', ...fields }));
  }

  it('counts internal packages from dependencies and devDependencies', () => {
    manifest('examples/app/package.json', {
      dependencies: { '@prisma-next/postgres': 'workspace:*', pg: '8' },
      devDependencies: { '@prisma-next/cli': 'workspace:*' },
    });
    commitAll('two internal packages');

    assert.deepEqual(
      scanManifests(repo, { path: 'examples' }).map((r) => `${r.field}:${r.package}`),
      ['dependencies:@prisma-next/postgres', 'devDependencies:@prisma-next/cli'],
    );
  });

  it('ignores published packages and third-party packages', () => {
    manifest('examples/app/package.json', {
      dependencies: { '@prisma/orm-postgres': '0.16.0', arktype: '^2', pg: 'catalog:' },
    });
    commitAll('facade-only manifest');

    assert.deepEqual(scanManifests(repo, { path: 'examples' }), []);
  });

  it('exempts @prisma-next/tsconfig, which is consumed via extends and never imported', () => {
    manifest('examples/app/package.json', {
      devDependencies: { '@prisma-next/tsconfig': 'workspace:*' },
    });
    commitAll('tsconfig only');

    assert.deepEqual(scanManifests(repo, { path: 'examples' }), []);
  });

  it('ignores manifests of installed dependencies', () => {
    manifest('examples/app/node_modules/pkg/package.json', {
      dependencies: { '@prisma-next/cli': '0.16.0' },
    });
    commitAll('vendored manifest');

    assert.deepEqual(scanManifests(repo, { path: 'examples' }), []);
  });

  it('reads nested consumer packages, which install independently', () => {
    manifest('examples/monorepo/package.json', {
      dependencies: { '@prisma-next/postgres': 'workspace:*' },
    });
    manifest('examples/monorepo/packages/audit/package.json', {
      dependencies: { '@prisma-next/sql-contract': 'workspace:*' },
    });
    commitAll('nested manifests');

    assert.equal(scanManifests(repo, { path: 'examples' }).length, 2);
  });
});

describe('lint-consumer-internal-imports — manifest threshold', () => {
  it('fails when a consumer declares more internal packages than recorded', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 0 }] });
    writeRepoFile(
      'examples/app/package.json',
      JSON.stringify({ name: 'app', dependencies: { '@prisma-next/postgres': 'workspace:*' } }),
    );
    commitAll('one declared internal package');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /scope=examples manifest=1 threshold=0/);
    assert.match(result.stderr, /raise "manifestThreshold" to 1/);
  });

  it('fails when a consumer declares fewer than recorded, so the win is locked in', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 3 }] });
    writeRepoFile(
      'examples/app/package.json',
      JSON.stringify({ name: 'app', dependencies: { '@prisma/orm-postgres': '0.16.0' } }),
    );
    commitAll('facade-only manifest');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /scope=examples manifest=0 threshold=3/);
    assert.match(result.stderr, /Lower "manifestThreshold" to 0/);
  });

  it('passes a consumer whose imports are clean but whose manifest is not, only at its threshold', () => {
    // The two measures are independent: importing nothing internal does not
    // make an install look like a real application's.
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 2 }] });
    writeRepoFile(
      'examples/app/package.json',
      JSON.stringify({
        name: 'app',
        dependencies: { '@prisma-next/postgres': 'workspace:*', '@prisma-next/cli': 'workspace:*' },
      }),
    );
    writeRepoFile('examples/app/src/main.ts', "import x from '@prisma/orm-postgres/runtime';\n");
    commitAll('clean imports, dirty manifest');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /scope=examples imports=0 threshold=0/);
    assert.match(result.stdout, /scope=examples manifest=2 threshold=2/);
  });
});

describe('lint-consumer-internal-imports — threshold met', () => {
  it('exits 0 when count equals threshold', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 1, manifestThreshold: 0 }] });
    writeRepoFile('examples/app/src/main.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 1');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /scope=examples imports=1 threshold=1/);
  });
});

describe('lint-consumer-internal-imports — count above threshold', () => {
  it('exits 1, names the offending file, and offers the threshold raise', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 0 }] });
    writeRepoFile('examples/app/src/main.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 0');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /imports=1 threshold=0/);
    assert.match(result.stderr, /examples\/app\/src\/main\.ts \(1\)/);
    assert.match(result.stderr, /raise.*threshold|facade/i);
  });
});

describe('lint-consumer-internal-imports — count below threshold', () => {
  it('exits 1 and instructs lowering the threshold', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 5, manifestThreshold: 0 }] });
    writeRepoFile('examples/app/src/main.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit, threshold 5');

    const result = runScript();
    assert.equal(result.status, 1, `expected exit 1; stdout=${result.stdout}`);
    assert.match(result.stdout, /imports=1 threshold=5/);
    assert.match(result.stderr, /Lower "threshold" to 1/);
  });
});

describe('lint-consumer-internal-imports — scope boundary', () => {
  it('counts each scope separately and ignores files outside every scope', () => {
    writeConfig({
      scopes: [
        { path: 'examples', threshold: 1, manifestThreshold: 0 },
        { path: 'apps', threshold: 0, manifestThreshold: 0 },
      ],
    });
    writeRepoFile('examples/app/src/main.ts', FILE_WITH_ONE_HIT);
    writeRepoFile('packages/lib/src/main.ts', FILE_WITH_ONE_HIT);
    commitAll('hit inside and outside scope');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /scope=examples imports=1 threshold=1/);
    assert.match(result.stdout, /scope=apps imports=0 threshold=0/);
  });
});

describe('lint-consumer-internal-imports — exclusions', () => {
  it('ignores build output and installed dependencies', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 0 }] });
    writeRepoFile('examples/app/dist/main.js', FILE_WITH_ONE_HIT);
    writeRepoFile('examples/app/node_modules/pkg/index.js', FILE_WITH_ONE_HIT);
    commitAll('excluded-only occurrences');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /imports=0 threshold=0/);
  });

  it('counts a published-root consumer as clean', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 0, manifestThreshold: 0 }] });
    writeRepoFile(
      'examples/app/src/main.ts',
      "import { orm } from '@prisma/orm-postgres/orm-client';\n",
    );
    commitAll('facade-only consumer');

    const result = runScript();
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /imports=0 threshold=0/);
  });
});

describe('lint-consumer-internal-imports — --list', () => {
  it('prints every current site', () => {
    writeConfig({ scopes: [{ path: 'examples', threshold: 1, manifestThreshold: 0 }] });
    writeRepoFile('examples/app/src/main.ts', FILE_WITH_ONE_HIT);
    commitAll('one hit');

    const result = runScript('--list');
    assert.equal(result.status, 0, `expected exit 0; stderr=${result.stderr}`);
    assert.match(result.stdout, /examples\/app\/src\/main\.ts:2: @prisma-next\/sql-orm-client/);
  });
});
