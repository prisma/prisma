import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { join } from 'pathe';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Fixtures, generateFixtures } from './fixture-generator';
import {
  appScript,
  copyFixture,
  extensionScript,
  fixturesDir,
  fixtureTree,
  readTree,
  removeWorkDirs,
  runScript,
  writeTree,
} from './test-helpers';

let generated: Fixtures;

beforeAll(async () => {
  generated = await generateFixtures();
  if (process.env['REMOVE_NOCHECK_FIXTURES_WRITE'] === '1') {
    rmSync(fixturesDir, { recursive: true, force: true });
    writeTree(join(fixturesDir, 'before'), generated.before);
    writeTree(join(fixturesDir, 'after'), generated.after);
  }
});

afterAll(removeWorkDirs);

function summary(files: number, directories: number): string {
  return [
    `Rewrote ${files} files and renamed ${directories} snapshot directories. Storage hashes changed (old -> new):`,
    ...[...generated.hashes]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([oldHash, newHash]) => `  ${oldHash} -> ${newHash}`),
    '',
  ].join('\n');
}

describe('the fixtures', () => {
  it('are what the live framework code builds', () => {
    expect({ before: fixtureTree('before'), after: fixtureTree('after') }).toEqual({
      before: generated.before,
      after: generated.after,
    });
  });

  it('after the upgrade, load as contracts whose stored hashes match their content', () => {
    const serializer = new PostgresContractSerializer();
    const after = fixtureTree('after');
    const contracts = Object.entries(after).filter(([path]) => path.endsWith('contract.json'));
    expect(contracts).toHaveLength(3);
    for (const [, text] of contracts) {
      expect(() => serializer.deserializeContract(JSON.parse(text))).not.toThrow();
    }
  });
});

describe('remove-nocheck', () => {
  it('removes the key, renames the snapshots and rewrites every reference to their hashes', () => {
    const run = runScript(copyFixture('before'));
    expect({
      status: run.status,
      stdout: run.stdout,
      stderr: run.stderr,
      tree: readTree(run.root),
    }).toEqual({
      status: 0,
      stdout: summary(7, 2),
      stderr: '',
      tree: fixtureTree('after'),
    });
  });

  it('leaves the checks each contract declares as they were', () => {
    const run = runScript(copyFixture('before'));
    const checksOf = (tree: Record<string, string>) =>
      JSON.parse(tree['prisma/contract.json'] ?? '{}').storage.namespaces.public.entries.table.post
        .checks;
    expect(checksOf(readTree(run.root))).toEqual(checksOf(fixtureTree('before')));
  });

  it('changes nothing in a project that stores no noCheck key', () => {
    const run = runScript(copyFixture('after'));
    expect({ status: run.status, stdout: run.stdout, tree: readTree(run.root) }).toEqual({
      status: 0,
      stdout: 'No contract stores a noCheck key; nothing changed.\n',
      tree: fixtureTree('after'),
    });
  });

  it('finishes an upgrade that stopped after writing a new snapshot directory', () => {
    const root = copyFixture('before');
    const [, newHash] = generated.hashes[0] ?? [];
    const snapshot = `migrations/snapshots/${newHash}`;
    mkdirSync(join(root, snapshot), { recursive: true });
    for (const name of ['contract.json', 'contract.d.ts'])
      writeFileSync(join(root, snapshot, name), fixtureTree('after')[`${snapshot}/${name}`] ?? '');
    const run = runScript(root);
    expect({ status: run.status, tree: readTree(root) }).toEqual({
      status: 0,
      tree: fixtureTree('after'),
    });
  });

  it('stops without changing a file when a new snapshot directory exists with other content', () => {
    const root = copyFixture('before');
    const [, newHash] = generated.hashes[0] ?? [];
    mkdirSync(join(root, 'migrations/snapshots', newHash ?? ''), { recursive: true });
    writeFileSync(join(root, 'migrations/snapshots', newHash ?? '', 'contract.json'), '{}\n');
    const before = readTree(root);
    const run = runScript(root);
    expect({ status: run.status, stderr: run.stderr, tree: readTree(root) }).toEqual({
      status: 1,
      stderr: `migrations/snapshots/${newHash}: snapshot directory already exists with different content\n`,
      tree: before,
    });
  });

  it('ships the same script for extensions', () => {
    expect(readFileSync(extensionScript, 'utf8')).toBe(readFileSync(appScript, 'utf8'));
  });
});
