import { match, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDirtyReport } from './check-clean-tree.mjs';

describe('formatDirtyReport', () => {
  it('returns null when porcelain output is empty', () => {
    strictEqual(formatDirtyReport(''), null);
  });

  it('includes a modified tracked file in the report', () => {
    const report = formatDirtyReport(' M packages/foo/contract.json');
    match(report, /Working tree is not clean/);
    match(report, / M packages\/foo\/contract\.json/);
  });

  it('includes an untracked file in the report', () => {
    const report = formatDirtyReport('?? scripts/leftover.tmp');
    match(report, /Working tree is not clean/);
    match(report, /\?\? scripts\/leftover\.tmp/);
  });

  it('preserves multiple porcelain entries verbatim', () => {
    const porcelain = [' M a.txt', '?? b.txt', 'A  c.txt'].join('\n');
    const report = formatDirtyReport(porcelain);
    match(report, / M a\.txt/);
    match(report, /\?\? b\.txt/);
    match(report, /A {2}c\.txt/);
  });
});
