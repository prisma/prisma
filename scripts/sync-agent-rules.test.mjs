import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { CANONICAL_DIR, PRESENTATION_DIRS, syncAgentRules } from './sync-agent-rules.mjs';

function makeRoot() {
  const root = mkdtempSync(join(tmpdir(), 'sync-agent-rules-'));
  mkdirSync(join(root, CANONICAL_DIR), { recursive: true });
  for (const dir of PRESENTATION_DIRS) mkdirSync(join(root, dir), { recursive: true });
  return root;
}

function writeCanonical(root, name, body = `# ${name}\n`) {
  writeFileSync(join(root, CANONICAL_DIR, name), body);
}

function isSymlinkTo(root, dir, name) {
  const full = join(root, dir, name);
  const stat = lstatSync(full);
  if (!stat.isSymbolicLink()) return false;
  // Target must resolve to the canonical file.
  return readFileSync(full, 'utf8') === readFileSync(join(root, CANONICAL_DIR, name), 'utf8');
}

describe('syncAgentRules (sync mode)', () => {
  it('symlinks every canonical .mdc rule into both presentation dirs', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');
    writeCanonical(root, 'beta.mdc');

    syncAgentRules({ root });

    for (const dir of PRESENTATION_DIRS) {
      ok(isSymlinkTo(root, dir, 'alpha.mdc'), `${dir}/alpha.mdc should be a symlink`);
      ok(isSymlinkTo(root, dir, 'beta.mdc'), `${dir}/beta.mdc should be a symlink`);
    }
  });

  it('mirrors the README.md index but not other .md files', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');
    writeCanonical(root, 'README.md', '# Rules Index\n');

    syncAgentRules({ root });

    for (const dir of PRESENTATION_DIRS) {
      ok(isSymlinkTo(root, dir, 'README.md'), `${dir}/README.md should be a symlink`);
    }
  });

  it('throws on a .md rule because only .mdc is ever loaded', () => {
    const root = makeRoot();
    writeCanonical(root, 'dead-rule.md');

    throws(() => syncAgentRules({ root }), /\.mdc/);
  });

  it('uses a relative symlink target pointing into the canonical dir', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');

    syncAgentRules({ root });

    const target = readlinkSync(join(root, PRESENTATION_DIRS[0], 'alpha.mdc'));
    strictEqual(target, '../../.agents/rules/alpha.mdc');
  });

  it('consolidates a real-file rule from a presentation dir into canonical', () => {
    const root = makeRoot();
    const strayDir = join(root, PRESENTATION_DIRS[0]);
    writeFileSync(join(strayDir, 'stray.mdc'), '# stray rule\n');

    syncAgentRules({ root });

    strictEqual(readFileSync(join(root, CANONICAL_DIR, 'stray.mdc'), 'utf8'), '# stray rule\n');
    for (const dir of PRESENTATION_DIRS) {
      ok(isSymlinkTo(root, dir, 'stray.mdc'), `${dir}/stray.mdc should now be a symlink`);
    }
  });

  it('is idempotent', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');

    syncAgentRules({ root });
    const second = syncAgentRules({ root });

    deepStrictEqual(second.actions, []);
    strictEqual(second.ok, true);
  });

  it('removes a dangling symlink in a presentation dir', () => {
    const root = makeRoot();
    symlinkSync('../../.agents/rules/ghost.mdc', join(root, PRESENTATION_DIRS[1], 'ghost.mdc'));

    const result = syncAgentRules({ root });

    throws(() => lstatSync(join(root, PRESENTATION_DIRS[1], 'ghost.mdc')));
    ok(result.actions.some((a) => a.includes('ghost.mdc')));
  });

  it('leaves a correct symlink untouched and reports no action', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');
    syncAgentRules({ root });

    const result = syncAgentRules({ root });
    deepStrictEqual(result.actions, []);
  });

  it('throws on a conflicting rule whose canonical copy differs', () => {
    const root = makeRoot();
    writeCanonical(root, 'dupe.mdc', '# canonical body\n');
    writeFileSync(join(root, PRESENTATION_DIRS[0], 'dupe.mdc'), '# DIFFERENT body\n');

    throws(() => syncAgentRules({ root }), /conflict/i);
  });

  it('treats an identical real-file copy as a no-conflict consolidation', () => {
    const root = makeRoot();
    writeCanonical(root, 'dupe.mdc', '# same body\n');
    writeFileSync(join(root, PRESENTATION_DIRS[0], 'dupe.mdc'), '# same body\n');

    syncAgentRules({ root });
    ok(isSymlinkTo(root, PRESENTATION_DIRS[0], 'dupe.mdc'));
  });

  it('ignores non-rule files in canonical (no .mdc extension)', () => {
    const root = makeRoot();
    writeFileSync(join(root, CANONICAL_DIR, 'notes.txt'), 'scratch\n');
    writeCanonical(root, 'alpha.mdc');

    syncAgentRules({ root });

    throws(() => lstatSync(join(root, PRESENTATION_DIRS[0], 'notes.txt')));
    ok(isSymlinkTo(root, PRESENTATION_DIRS[0], 'alpha.mdc'));
  });
});

describe('syncAgentRules (check mode)', () => {
  it('passes when everything is in sync', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');
    syncAgentRules({ root });

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, true);
    deepStrictEqual(result.drift, []);
  });

  it('reports a missing symlink and does not mutate', () => {
    const root = makeRoot();
    writeCanonical(root, 'alpha.mdc');

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, false);
    ok(result.drift.some((d) => d.includes('alpha.mdc')));
    // check mode must not create the symlink
    throws(() => lstatSync(join(root, PRESENTATION_DIRS[0], 'alpha.mdc')));
  });

  it('reports a real-file rule sitting in a presentation dir', () => {
    const root = makeRoot();
    writeFileSync(join(root, PRESENTATION_DIRS[0], 'stray.mdc'), '# stray\n');

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, false);
    ok(result.drift.some((d) => /stray\.mdc/.test(d)));
  });

  it('reports a dangling symlink', () => {
    const root = makeRoot();
    symlinkSync('../../.agents/rules/ghost.mdc', join(root, PRESENTATION_DIRS[1], 'ghost.mdc'));

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, false);
    ok(result.drift.some((d) => d.includes('ghost.mdc')));
  });

  it('reports a .md rule as dead drift without throwing', () => {
    const root = makeRoot();
    writeCanonical(root, 'dead-rule.md');

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, false);
    ok(result.drift.some((d) => /dead-rule\.md/.test(d) && /\.mdc/.test(d)));
  });

  it('does not flag README.md as a dead rule', () => {
    const root = makeRoot();
    writeCanonical(root, 'README.md', '# Rules Index\n');
    syncAgentRules({ root });

    const result = syncAgentRules({ root, check: true });
    strictEqual(result.ok, true);
  });
});
