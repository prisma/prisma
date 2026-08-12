import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  findDeclarationDepViolations,
  moduleSpecifiersIn,
  packageNameFromSpecifier,
  publishedEntryRoots,
  runCheck,
  typesPackageFor,
} from './check-publish-deps.mjs';

describe('packageNameFromSpecifier', () => {
  it('returns the package a bare specifier belongs to', () => {
    assert.equal(packageNameFromSpecifier('pg'), 'pg');
    assert.equal(packageNameFromSpecifier('pg/lib/client'), 'pg');
    assert.equal(packageNameFromSpecifier('@internal/contract'), '@internal/contract');
    assert.equal(packageNameFromSpecifier('@internal/contract/types'), '@internal/contract');
  });

  it('returns null for specifiers that name no package', () => {
    assert.equal(packageNameFromSpecifier('./relative'), null);
    assert.equal(packageNameFromSpecifier('../up'), null);
    assert.equal(packageNameFromSpecifier('/absolute'), null);
    assert.equal(packageNameFromSpecifier('#private/subpath'), null);
    assert.equal(packageNameFromSpecifier(''), null);
  });

  it('returns null for Node builtins, prefixed or bare', () => {
    assert.equal(packageNameFromSpecifier('node:fs'), null);
    assert.equal(packageNameFromSpecifier('fs'), null);
    assert.equal(packageNameFromSpecifier('node:stream/promises'), null);
  });
});

describe('typesPackageFor', () => {
  it('maps an unscoped package to its DefinitelyTyped companion', () => {
    assert.equal(typesPackageFor('pg'), '@types/pg');
  });

  it('mangles the scope separator, matching npm convention', () => {
    assert.equal(typesPackageFor('@scope/pkg'), '@types/scope__pkg');
  });
});

describe('moduleSpecifiersIn', () => {
  it('collects imports, re-exports, side-effect imports and import() types', () => {
    const specs = moduleSpecifiersIn(`
      import { Client } from "pg";
      export { Foo } from "@scope/foo";
      import "arktype";
      declare const x: import("@scope/lazy").Thing;
    `);
    for (const expected of ['pg', '@scope/foo', 'arktype', '@scope/lazy']) {
      assert.ok(specs.includes(expected), `expected ${expected} in ${JSON.stringify(specs)}`);
    }
  });

  it('ignores module names that appear only in doc-comment prose', () => {
    // A regex scanner reads "imported from 'pg'" below as an import.
    // Emitted declarations carry prose like this, so the check must not.
    const specs = moduleSpecifiersIn(`
      /**
       * Advisory context surfaced to driver hooks (e.g. pg-pool's 'release'
       * event). Historically imported from 'pg', now inlined.
       */
      export declare const reason: string;
    `);
    assert.deepEqual(specs, []);
  });
});

describe('publishedEntryRoots', () => {
  it('collects the directories exports and types targets live in', () => {
    assert.deepEqual(
      publishedEntryRoots({
        types: './dist/index.d.mts',
        exports: { '.': './dist/index.mjs', './control': './dist/control.mjs' },
      }),
      new Set(['dist']),
    );
  });

  it('ignores the package.json self-reference, which is not a code entry', () => {
    assert.deepEqual(
      publishedEntryRoots({ exports: { './package.json': './package.json' } }),
      new Set(),
    );
  });

  it('collects every root when a package publishes from more than one', () => {
    assert.deepEqual(
      publishedEntryRoots({ exports: { '.': './dist/index.mjs', './raw': './lib/raw.js' } }),
      new Set(['dist', 'lib']),
    );
  });

  it('yields the package root for an entry with no directory component', () => {
    assert.deepEqual(
      publishedEntryRoots({
        types: './index.d.ts',
        exports: { '.': './index.js', './package.json': './package.json' },
      }),
      new Set(['.']),
    );
  });
});

describe('findDeclarationDepViolations', () => {
  function check(pkgJson, declarations, typeAvailability = {}) {
    return findDeclarationDepViolations({
      pkgJson: { exports: { '.': './dist/index.mjs' }, ...pkgJson },
      declarations: new Map(Object.entries(declarations)),
      shipsOwnTypes: (name) => typeAvailability[name] ?? true,
    });
  }

  it('passes when every named module is a declared dependency', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a', dependencies: { '@scope/dep': '1.0.0' } },
        { 'dist/index.d.mts': 'import { X } from "@scope/dep";' },
      ),
      [],
    );
  });

  it('flags a module that is only a devDependency', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a', devDependencies: { arktype: '^2.2.2' } },
        { 'dist/index.d.mts': 'import "arktype";' },
      ),
      [{ file: 'dist/index.d.mts', spec: 'arktype', kind: 'undeclared', needs: 'arktype' }],
    );
  });

  it('accepts peerDependencies, which consumers do install', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a', peerDependencies: { '@scope/dep': '1.0.0' } },
        { 'dist/index.d.mts': 'import { X } from "@scope/dep";' },
      ),
      [],
    );
  });

  it('flags a declared dependency whose types live in an undeclared @types package', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a', dependencies: { pg: '8.22.0' } },
        { 'dist/index.d.mts': 'import { Client } from "pg";' },
        { pg: false },
      ),
      [{ file: 'dist/index.d.mts', spec: 'pg', kind: 'untyped', needs: '@types/pg' }],
    );
  });

  it('passes once the @types companion is declared', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a', dependencies: { pg: '8.22.0', '@types/pg': '8.20.0' } },
        { 'dist/index.d.mts': 'import { Client } from "pg";' },
        { pg: false },
      ),
      [],
    );
  });

  it('skips the types rule when the dependency cannot be resolved', () => {
    assert.deepEqual(
      findDeclarationDepViolations({
        pkgJson: {
          name: '@scope/a',
          exports: { '.': './dist/index.mjs' },
          dependencies: { pg: '8.22.0' },
        },
        declarations: new Map([['dist/index.d.mts', 'import { Client } from "pg";']]),
        shipsOwnTypes: () => null,
      }),
      [],
    );
  });

  it('checks a package that publishes from the tarball root', () => {
    // A root-level entry has no directory component. When that produced an
    // empty root set, the lookup matched nothing and every declaration in the
    // tarball went unchecked — a green result that inspected no files.
    assert.deepEqual(
      findDeclarationDepViolations({
        pkgJson: {
          name: '@scope/rooted',
          types: './index.d.ts',
          exports: { '.': './index.js', './package.json': './package.json' },
          devDependencies: { arktype: '^2.2.2' },
        },
        declarations: new Map([['index.d.ts', 'import "arktype";']]),
        shipsOwnTypes: () => true,
      }),
      [{ file: 'index.d.ts', spec: 'arktype', kind: 'undeclared', needs: 'arktype' }],
    );
  });

  it('still scopes to subdirectories when a package publishes from both', () => {
    assert.deepEqual(
      findDeclarationDepViolations({
        pkgJson: {
          name: '@scope/mixed',
          types: './index.d.ts',
          exports: { '.': './index.js', './deep': './dist/deep.mjs' },
        },
        declarations: new Map([
          ['index.d.ts', 'import "rooted-gone";'],
          ['dist/deep.d.mts', 'import "nested-gone";'],
          ['src/internal.d.ts', 'import "ignored";'],
        ]),
        shipsOwnTypes: () => true,
      }).map((v) => `${v.file}:${v.spec}`),
      ['index.d.ts:rooted-gone', 'dist/deep.d.mts:nested-gone'],
    );
  });

  it('ignores declarations outside the published entry-point tree', () => {
    // Tarballs ship `src/` so declaration maps resolve; nothing in a
    // consumer's module graph reaches those files.
    assert.deepEqual(
      check(
        { name: '@scope/a', devDependencies: { '@scope/dep': '1.0.0' } },
        { 'src/contract.d.ts': 'import { X } from "@scope/dep";' },
      ),
      [],
    );
  });

  it('ignores a package referencing itself through its own exports map', () => {
    assert.deepEqual(
      check({ name: '@scope/a' }, { 'dist/index.d.mts': 'import { X } from "@scope/a/sub";' }),
      [],
    );
  });

  it('reports each offending module once per file', () => {
    assert.deepEqual(
      check(
        { name: '@scope/a' },
        {
          'dist/index.d.mts': 'import { A } from "gone"; export { B } from "gone";',
          'dist/other.d.mts': 'import { C } from "gone";',
        },
      ).map((v) => v.file),
      ['dist/index.d.mts', 'dist/other.d.mts'],
    );
  });

  it('flags a private workspace package like any other undeclared module', () => {
    // `@repo/test-utils` is `private: true` and never published, so a
    // shipped declaration naming it can never resolve for a consumer.
    assert.deepEqual(
      check(
        { name: '@internal/sql-runtime', devDependencies: { '@repo/test-utils': '*' } },
        { 'dist/test/utils.d.mts': 'import { X } from "@repo/test-utils";' },
      ),
      [
        {
          file: 'dist/test/utils.d.mts',
          spec: '@repo/test-utils',
          kind: 'undeclared',
          needs: '@repo/test-utils',
        },
      ],
    );
  });
});

describe('runCheck declaration-dependency gate', () => {
  function makeIo(overrides = {}) {
    return {
      listPublishablePackageDirs: () => ['packages/foo'],
      mkdtemp: () => '/tmp/pn-publish-check-fake',
      rm: () => {},
      readdirSync: () => ['scope-foo-1.0.0.tgz'],
      readPackageJson: () => ({ name: '@scope/foo', version: '1.0.0' }),
      readPackedManifest: () => ({ name: '@scope/foo', exports: { '.': './dist/index.mjs' } }),
      readPackedDeclarations: () => new Map(),
      dependencyShipsOwnTypes: () => null,
      packAll: () => 0,
      stdoutWrite: () => {},
      stderrWrite: () => {},
      ...overrides,
    };
  }

  it('fails a package whose shipped declaration names an undeclared module', () => {
    const io = makeIo({
      readPackedManifest: () => ({
        name: '@scope/foo',
        exports: { '.': './dist/index.mjs' },
        devDependencies: { arktype: '^2.2.2' },
      }),
      readPackedDeclarations: () => new Map([['dist/index.d.mts', 'import "arktype";']]),
    });
    assert.equal(runCheck({ argv: [], io }), 1);
  });

  it('reports the violation in the JSON payload', () => {
    const written = [];
    const io = makeIo({
      readPackedManifest: () => ({
        name: '@scope/foo',
        exports: { '.': './dist/index.mjs' },
        dependencies: { pg: '8.22.0' },
      }),
      readPackedDeclarations: () => new Map([['dist/index.d.mts', 'import { Client } from "pg";']]),
      dependencyShipsOwnTypes: () => false,
      stdoutWrite: (s) => written.push(s),
    });

    assert.equal(runCheck({ argv: ['--json'], io }), 1);
    const payload = JSON.parse(written.join(''));
    assert.equal(payload.ok, false);
    assert.deepEqual(payload.offenders[0].declarationDepViolations, [
      { file: 'dist/index.d.mts', spec: 'pg', kind: 'untyped', needs: '@types/pg' },
    ]);
  });

  it('passes a package whose declarations name only declared dependencies', () => {
    const io = makeIo({
      readPackedManifest: () => ({
        name: '@scope/foo',
        exports: { '.': './dist/index.mjs' },
        dependencies: { arktype: '^2.2.2' },
      }),
      readPackedDeclarations: () => new Map([['dist/index.d.mts', 'import "arktype";']]),
    });
    assert.equal(runCheck({ argv: [], io }), 0);
  });
});
