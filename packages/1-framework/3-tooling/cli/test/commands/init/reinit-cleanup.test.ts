import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findStaleArtifacts, removeDependency } from '../../../src/commands/init/reinit-cleanup';

describe('findStaleArtifacts (FR9.1)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'reinit-find-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the empty list when the schema dir does not exist', () => {
    expect(findStaleArtifacts(tmpDir, 'prisma')).toEqual([]);
  });

  it('returns the empty list when no artifact files are present', () => {
    mkdirSync(join(tmpDir, 'prisma'));
    writeFileSync(join(tmpDir, 'prisma', 'contract.prisma'), 'model User {}');
    expect(findStaleArtifacts(tmpDir, 'prisma')).toEqual([]);
  });

  it('returns each known artifact filename present in the schema dir', () => {
    mkdirSync(join(tmpDir, 'prisma'));
    writeFileSync(join(tmpDir, 'prisma', 'contract.json'), '{}');
    writeFileSync(join(tmpDir, 'prisma', 'contract.d.ts'), 'export {}');
    writeFileSync(join(tmpDir, 'prisma', 'ops.json'), '{}');
    expect(findStaleArtifacts(tmpDir, 'prisma')).toEqual([
      'prisma/contract.json',
      'prisma/contract.d.ts',
      'prisma/ops.json',
    ]);
  });

  it('honours a non-default schema dir', () => {
    mkdirSync(join(tmpDir, 'db', 'nested'), { recursive: true });
    writeFileSync(join(tmpDir, 'db', 'nested', 'contract.json'), '{}');
    expect(findStaleArtifacts(tmpDir, 'db/nested')).toEqual(['db/nested/contract.json']);
  });

  it('does not flag unrelated files that just happen to live in the schema dir', () => {
    mkdirSync(join(tmpDir, 'prisma'));
    writeFileSync(join(tmpDir, 'prisma', 'contract.prisma'), 'model User {}');
    writeFileSync(join(tmpDir, 'prisma', 'README.md'), '# notes');
    writeFileSync(join(tmpDir, 'prisma', 'seed.ts'), 'export {}');
    expect(findStaleArtifacts(tmpDir, 'prisma')).toEqual([]);
  });
});

describe('removeDependency (FR9.2)', () => {
  it('returns null when dependencies is missing', () => {
    expect(removeDependency('{"name":"app"}', '@internal/postgres')).toBeNull();
  });

  it('returns null when dependencies is not an object', () => {
    expect(removeDependency('{"dependencies":[]}', '@internal/postgres')).toBeNull();
  });

  it('returns null when the named dep is absent', () => {
    expect(
      removeDependency(
        JSON.stringify({ dependencies: { '@internal/mongo': '^1.0.0' } }),
        '@internal/postgres',
      ),
    ).toBeNull();
  });

  it('drops the named dep and preserves siblings', () => {
    const before = JSON.stringify(
      {
        name: 'app',
        dependencies: {
          '@internal/postgres': '^1.0.0',
          dotenv: '^16.0.0',
        },
        devDependencies: { typescript: '^5.0.0' },
      },
      null,
      2,
    );
    const after = removeDependency(before, '@internal/postgres');
    expect(after).not.toBeNull();
    const parsed = JSON.parse(after as string) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(parsed.dependencies).toEqual({ dotenv: '^16.0.0' });
    expect(parsed.devDependencies).toEqual({ typescript: '^5.0.0' });
  });

  it('preserves a trailing newline when present', () => {
    const before = `${JSON.stringify({ dependencies: { foo: '1.0.0' } }, null, 2)}\n`;
    const after = removeDependency(before, 'foo') as string;
    expect(after.endsWith('\n')).toBe(true);
  });

  it('omits a trailing newline when the input lacked one', () => {
    const before = JSON.stringify({ dependencies: { foo: '1.0.0' } }, null, 2);
    const after = removeDependency(before, 'foo') as string;
    expect(after.endsWith('\n')).toBe(false);
  });

  it('does not touch peerDependencies or devDependencies', () => {
    const before = JSON.stringify(
      {
        dependencies: { '@internal/postgres': '^1.0.0' },
        peerDependencies: { '@internal/postgres': '^1.0.0' },
      },
      null,
      2,
    );
    const after = removeDependency(before, '@internal/postgres') as string;
    const parsed = JSON.parse(after) as {
      dependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    expect(parsed.dependencies).toEqual({});
    expect(parsed.peerDependencies).toEqual({ '@internal/postgres': '^1.0.0' });
  });
});
