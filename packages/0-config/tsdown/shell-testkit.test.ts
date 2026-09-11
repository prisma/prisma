import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { type PackedShell, tryInstallShells } from './shell-testkit';

const originalPath = process.env['PATH'];

afterEach(() => {
  process.env['PATH'] = originalPath;
});

test('scratch workspace pins Node types while preserving shell overrides and install options', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'shell-testkit-'));
  const binDir = join(tempDir, 'bin');
  mkdirSync(binDir);
  const fakePnpm = join(binDir, 'pnpm');
  writeFileSync(fakePnpm, '#!/bin/sh\nexit 0\n');
  chmodSync(fakePnpm, 0o755);
  process.env['PATH'] = `${binDir}:${originalPath ?? ''}`;

  const scratchDir = join(tempDir, 'scratch');
  const shells: readonly PackedShell[] = [
    { name: '@prisma/orm-framework', tarball: '/tmp/orm-framework.tgz' },
    {
      name: '@prisma/orm-target-postgres',
      tarball: '/tmp/orm-target-postgres.tgz',
      override: false,
    },
  ];

  const result = tryInstallShells(scratchDir, shells, {
    direct: ['@prisma/orm-framework'],
    npmrc: ['strict-peer-dependencies=true', 'store-dir=/tmp/store=a'],
  });

  assert.equal(result.ok, true);
  assert.equal(
    readFileSync(join(scratchDir, 'pnpm-workspace.yaml'), 'utf8'),
    'overrides:\n' +
      '  "@prisma/orm-framework": "file:/tmp/orm-framework.tgz"\n' +
      '  "@types/node": "26.1.2"\n' +
      'minimumReleaseAge: 1440\n' +
      'minimumReleaseAgeExclude:\n' +
      '  - "@prisma/cli-engine"\n' +
      '  - "@prisma/dev"\n' +
      '  - "@prisma/streams-local"\n' +
      'strictPeerDependencies: true\n' +
      'storeDir: "/tmp/store=a"\n',
  );
  assert.equal(
    readFileSync(join(scratchDir, '.npmrc'), 'utf8'),
    'strict-peer-dependencies=true\nstore-dir=/tmp/store=a\n',
  );
});
